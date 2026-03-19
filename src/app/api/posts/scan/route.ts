import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';

interface FacebookImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

function extractPostId(url: string): string | null {
  const patterns = [
    /facebook\.com\/.*?\/posts\/([\w]+)/i,
    /facebook\.com\/photo\/?\?fbid=([\w]+)/i,
    /pfbid[\w]+/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getSessionCookies() {
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!session?.fbCookies) return null;

  try {
    return JSON.parse(session.fbCookies);
  } catch {
    return null;
  }
}

async function findAndClickFirstImage(page: any): Promise<boolean> {
  console.log('Finding image using Tab navigation...');
  
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  for (let tabCount = 0; tabCount < 100; tabCount++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      
      const tagName = el.tagName.toLowerCase();
      const href = (el as HTMLAnchorElement).href || '';
      
      return {
        tagName,
        href,
        isPhotoLink: href.includes('/photo/') && href.includes('fbid='),
        isMediaSet: href.includes('/media/set/'),
        isGroup: href.includes('/groups/'),
        isProfile: href.match(/\/\d{10,}/) !== null,
        isPage: href.includes('/pages/'),
        isStory: href.includes('/status/'),
        isNav: tagName === 'a' || tagName === 'button',
      };
    });

    if (!focusedElement) continue;

    const shortHref = focusedElement.href?.substring(0, 70) || 'no href';
    
    if (focusedElement.isPhotoLink) {
      console.log(`✅ Found photo link! Clicking directly...`);
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        el?.click();
      });
      await page.waitForTimeout(4000);
      return true;
    }

    if (focusedElement.isMediaSet || focusedElement.isGroup || focusedElement.isProfile || focusedElement.isPage || focusedElement.isStory || focusedElement.isNav) {
      continue;
    }
  }
  
  console.log('Tab navigation complete, trying direct selector...');
  return false;
}

async function extractImagesFromDialog(page: any, seenUrls: Set<string>): Promise<FacebookImage[]> {
  const images: FacebookImage[] = [];
  let imgCount = 0;
  const maxImages = 50;

  console.log('Waiting for dialog to fully load...');
  await page.waitForTimeout(3000);

  const getDialogImageUrl = async (): Promise<string | null> => {
    // Tìm trong SVG image elements (thường chứa ảnh HD)
    try {
      const svgImageSelectors = [
        'div[role="dialog"] svg image[href*="scontent"]',
        'div[role="dialog"] svg image[href*="fbcdn"]',
        'div[role="dialog"] svg image[xlink\\:href*="scontent"]',
        '[data-pagelet*="MediaViewer"] svg image[href*="scontent"]',
      ];
      
      for (const selector of svgImageSelectors) {
        const svgImages = await page.$$(selector);
        for (const svgImg of svgImages) {
          const href = await svgImg.getAttribute('href') || await svgImg.getAttribute('xlink:href');
          if (href && (href.includes('scontent') || href.includes('fbcdn'))) {
            const cleanUrl = href.split('?')[0];
            console.log(`   Found SVG HD image: ${cleanUrl.substring(0, 60)}...`);
            return href;
          }
        }
      }
    } catch (e) {
      console.log(`   SVG search error: ${e}`);
    }
    
    // Tìm img có kích thước lớn (HD)
    try {
      const allImages = await page.$$('div[role="dialog"] img[src*="scontent"], div[role="dialog"] img[src*="fbcdn"]');
      let largestImage = null;
      let largestSize = 0;
      
      for (const img of allImages) {
        const src = await img.getAttribute('src');
        if (src && (src.includes('scontent') || src.includes('fbcdn'))) {
          // Kiểm tra kích thước từ URL (thường có cấu trúc như sxxxxx là kích thước)
          const urlLower = src.toLowerCase();
          // Ưu tiên URL có 'scontent' và không có các tham số thumbnail
          const isNotThumbnail = !src.includes('_nc_') || src.includes('scontent');
          const isLikelyHD = src.includes('scontent.fsgn') || src.includes('scontent.fsbk');
          
          if (isNotThumbnail && (isLikelyHD || !largestImage)) {
            largestImage = src;
            largestSize++;
          }
        }
      }
      
      if (largestImage) {
        console.log(`   Found likely HD image: ${largestImage.substring(0, 60)}...`);
        return largestImage;
      }
    } catch (e) {
      console.log(`   Image search error: ${e}`);
    }
    
    // Fallback: lấy bất kỳ ảnh scontent nào
    try {
      const anyImage = await page.$('div[role="dialog"] img[src*="scontent"]');
      if (anyImage) {
        const src = await anyImage.getAttribute('src');
        if (src) {
          console.log(`   Fallback to: ${src.substring(0, 60)}...`);
          return src;
        }
      }
    } catch {}
    
    return null;
  };

  const waitForNewImage = async (previousUrl: string): Promise<string | null> => {
    console.log(`   Waiting for new image to load...`);
    
    for (let wait = 0; wait < 15; wait++) {
      await page.waitForTimeout(1000);
      
      const currentUrl = await getDialogImageUrl();
      
      if (!currentUrl) {
        console.log(`   Still no image found...`);
        continue;
      }
      
      // So sánh URL đầy đủ, không cắt
      const isSame = currentUrl === previousUrl || currentUrl.includes(previousUrl.split('?')[0].split('/').pop() || '');
      const isNewUrl = !isSame && currentUrl !== previousUrl;
      
      if (isNewUrl) {
        console.log(`   ✅ New image loaded after ${wait + 1}s`);
        console.log(`   New URL: ${currentUrl.substring(0, 60)}...`);
        return currentUrl;
      }
      
      if (wait % 3 === 0) {
        console.log(`   Still loading... ${wait + 1}s`);
      }
    }
    
    return null;
  };

  console.log('Starting to extract images from dialog...');
  
  while (imgCount < maxImages) {
    console.log(`\nChecking image ${imgCount + 1}...`);
    
    const currentUrl = await getDialogImageUrl();

    if (currentUrl) {
      const cleanUrl = currentUrl.split('?')[0];
      console.log(`   Current URL: ${cleanUrl}`);
      
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        images.push({ url: currentUrl, alt: `Image ${imgCount + 1}` });
        console.log(`✅ Collected image ${imgCount + 1}: ${cleanUrl.substring(0, 60)}...`);
        imgCount++;
        
        if (imgCount >= maxImages) {
          console.log(`Reached max images limit (${maxImages})`);
          break;
        }
        
        console.log(`   Pressing ArrowRight...`);
        await page.keyboard.press('ArrowRight');
        
        const newUrl = await waitForNewImage(cleanUrl);
        
        if (!newUrl) {
          console.log(`🔄 No new image loaded after waiting, stopping...`);
          break;
        }
        
        const newCleanUrl = newUrl.split('?')[0];
        if (seenUrls.has(newCleanUrl) || newUrl === currentUrl) {
          console.log(`🔄 Looped back to existing image (${seenUrls.size} total), stopping...`);
          break;
        }
      } else {
        console.log(`🔄 Already seen this image (loop detected), stopping...`);
        break;
      }
    } else {
      console.log(`⚠️ No image found in dialog`);
      break;
    }
  }

  console.log(`\nExtraction complete: ${images.length} images collected`);
  return images;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('facebook.com')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Facebook URL' },
        { status: 400 }
      );
    }

    const session = await getSessionCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Please login first' },
        { status: 401 }
      );
    }

    const cookies = session;
    const postId = extractPostId(url);

    const normalizedCookies = cookies.map((cookie: any) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.facebook.com',
      path: cookie.path || '/',
      expires: cookie.expires || -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure !== false,
      sameSite: cookie.sameSite === 'Strict' || cookie.sameSite === 'Lax' || cookie.sameSite === 'None' 
        ? cookie.sameSite 
        : 'Lax',
    }));

    const browser = await chromium.launch({ 
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    
    await context.addCookies(normalizedCookies);
    const page = await context.newPage();
    
    console.log('Navigating to:', url);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log('Navigation warning:', e);
    }

    console.log('Waiting for page to fully load...');
    await page.waitForTimeout(5000);

    console.log('Scrolling to load content...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(1000);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(2000);

    let title = '';
    try {
      const titleElement = await page.$('h1 span');
      if (titleElement) {
        title = await titleElement.textContent() || '';
      }
      if (!title) {
        const h1 = await page.$('h1');
        if (h1) {
          title = await h1.textContent() || '';
        }
      }
    } catch {
      title = '';
    }

    const seenUrls = new Set<string>();
    const images: FacebookImage[] = [];

    console.log('Looking for images to click...');

    const foundDialog = await findAndClickFirstImage(page);
    
    if (foundDialog) {
      console.log('Dialog opened, extracting images...');
      await page.waitForTimeout(2000);
      
      const dialogImages = await extractImagesFromDialog(page, seenUrls);
      images.push(...dialogImages);
    } else {
      console.log('Could not open dialog via Tab, trying direct click on photo links...');
      
      const photoLinkSelectors = [
        'a[href*="/photo/"][href*="fbid="]',
        'a[href*="/photo/?fbid="]',
        'div[role="article"] a[href*="/photo/"]',
        '[data-pagelet*="FeedUnit"] a[href*="/photo/"]',
      ];

      for (const selector of photoLinkSelectors) {
        try {
          const photoLinks = await page.$$(selector);
          console.log(`Found ${photoLinks.length} photo links with selector: ${selector}`);
          
          if (photoLinks.length > 0) {
            const firstLink = photoLinks[0];
            const href = await firstLink.getAttribute('href');
            console.log(`Clicking first photo link: ${href}`);
            await firstLink.click();
            await page.waitForTimeout(3000);
            
            const dialogOpened = await page.$('div[role="dialog"], div[aria-label*="photo"]');
            if (dialogOpened) {
              console.log('Dialog opened via photo link click');
              const dialogImages = await extractImagesFromDialog(page, seenUrls);
              images.push(...dialogImages);
            } else {
              console.log('Dialog not opened, checking for image in new page...');
              const pageImages = await page.$$('img[src*="scontent"], img[src*="fbcdn"]');
              for (const img of pageImages) {
                const src = await img.getAttribute('src');
                if (src && (src.includes('scontent') || src.includes('fbcdn'))) {
                  const cleanUrl = src.split('?')[0];
                  if (!seenUrls.has(cleanUrl)) {
                    seenUrls.add(cleanUrl);
                    images.push({ url: cleanUrl });
                  }
                }
              }
            }
            break;
          }
        } catch (e) {
          console.log('Error with photo link selector:', e);
        }
      }

      if (images.length === 0) {
        console.log('Trying fallback selectors...');
        const fallbackSelectors = [
          'img[src*="scontent"]',
          'img[src*="fbcdn"]',
        ];

        for (const selector of fallbackSelectors) {
          try {
            const imgs = await page.$$(selector);
            console.log(`Found ${imgs.length} images with: ${selector}`);
            
            for (let i = 0; i < Math.min(imgs.length, 10); i++) {
              const src = await imgs[i].getAttribute('src');
              if (src && (src.includes('scontent') || src.includes('fbcdn'))) {
                const cleanUrl = src.split('?')[0];
                if (!seenUrls.has(cleanUrl)) {
                  seenUrls.add(cleanUrl);
                  images.push({ url: cleanUrl });
                  console.log(`Added fallback image: ${cleanUrl.substring(0, 60)}...`);
                }
              }
            }
            
            if (images.length > 0) break;
          } catch {}
        }
      }
    }

    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
    const minWidth = settings?.minImageWidth || 0;
    const minHeight = settings?.minImageHeight || 0;

    const originalCount = images.length;
    if (minWidth > 0 || minHeight > 0) {
      images.splice(0, images.length, ...images.filter(img => {
        if (!img.width || !img.height) return true;
        return img.width >= minWidth && img.height >= minHeight;
      }));
      console.log(`Filtered ${originalCount - images.length} low-quality images`);
    }

    await browser.close();

    const postType = url.includes('/groups/') ? 'group' : url.includes('/pages/') ? 'page' : 'post';

    const viewHistory = await prisma.viewHistory.create({
      data: {
        url,
        type: postType,
        title: title.substring(0, 255) || `Post ${postId}`,
        imagesCount: images.length,
        metadata: JSON.stringify({
          postId,
          images: images.map((img) => ({ 
            url: img.url, 
            alt: img.alt,
            width: img.width,
            height: img.height,
          })),
        }),
      },
    });

    console.log(`Scan complete: ${images.length} images found`);

    return NextResponse.json({
      success: true,
      viewId: viewHistory.id,
      postId,
      imagesCount: images.length,
      images: images,
      title,
    });
  } catch (error) {
    console.error('Scan post error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to scan post' },
      { status: 500 }
    );
  }
}
