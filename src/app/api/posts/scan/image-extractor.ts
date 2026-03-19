import { Page } from 'playwright';
import { FacebookImage } from './types';

export async function findAndClickFirstImage(page: Page): Promise<boolean> {
  console.log('Finding image using Tab navigation...');
  
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('load');


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
      await page.waitForTimeout(2000);
      return true;
    }

    if (focusedElement.isMediaSet || focusedElement.isGroup || focusedElement.isProfile || focusedElement.isPage || focusedElement.isStory || focusedElement.isNav) {
      continue;
    }
  }
  
  console.log('Tab navigation complete, trying direct selector...');
  return false;
}

export async function extractImagesFromFullView(page: Page, seenUrls: Set<string>): Promise<FacebookImage[]> {
  const images: FacebookImage[] = [];
  let imgCount = 0;
  const maxImages = 100;

  console.log('Waiting for dialog to fully load...');
  await page.waitForLoadState('load');

  const getDialogImageUrl = async (): Promise<string | null> => {
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
    
    try {
      const allImages = await page.$$('div[role="dialog"] img[src*="scontent"], div[role="dialog"] img[src*="fbcdn"]');
      let largestImage = null;
      let largestSize = 0;
      
      for (const img of allImages) {
        const src = await img.getAttribute('src');
        const isInMain = await img.evaluate((node) => !!node.closest('div[role="main"]'));
        const isInSidebar = await img.evaluate((node) => !!node.closest('div[role="complementary"]'));
        if (isInSidebar) continue;

        if (src && (src.includes('scontent') || src.includes('fbcdn'))) {
          const urlLower = src.toLowerCase();
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
      await page.waitForTimeout(100);
      await page.waitForLoadState('load');
      
      const currentUrl = await getDialogImageUrl();
      
      if (!currentUrl) {
        console.log(`   Still no image found...`);
        continue;
      }
      
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

export async function getImageUrlsFromPage(page: Page): Promise<FacebookImage[]> {
  const seenUrls = new Set<string>();
  const images: FacebookImage[] = [];

  console.log('Looking for images to click...');

  const findImage = await findAndClickFirstImage(page);

  if (findImage) {
    console.log('Image full view opened, extracting images...');

    const allImages = await extractImagesFromFullView(page, seenUrls);
    images.push(...allImages);
  }

  return images;
}