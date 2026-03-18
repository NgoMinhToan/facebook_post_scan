import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

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
    /facebook\.com\/.*?\/([\w]{10,})/i,
    /pfbid[\w]+/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractImagesFromHtml(html: string): FacebookImage[] {
  const images: FacebookImage[] = [];
  const $ = cheerio.load(html);

  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src && (src.includes('scontent') || src.includes('fbcdn') || src.includes('amazonaws'))) {
      const alt = $(img).attr('alt') || '';
      const width = parseInt($(img).attr('width') || '0');
      const height = parseInt($(img).attr('height') || '0');
      
      if (!images.find((i) => i.url === src)) {
        images.push({ url: src, alt, width, height });
      }
    }
  });

  $('image', 'svg').each((_, img) => {
    const href = $(img).attr('href') || $(img).attr('xlink:href');
    if (href && (href.includes('scontent') || href.includes('fbcdn'))) {
      if (!images.find((i) => i.url === href)) {
        images.push({ url: href });
      }
    }
  });

  return images;
}

function extractImagesFromPost(postHtml: string): FacebookImage[] {
  const images: FacebookImage[] = [];
  const $ = cheerio.load(postHtml);

  $('img').each((_, img) => {
    const src = $(img).attr('src') || $(img).attr('data-src');
    if (src && (src.includes('scontent') || src.includes('fbcdn') || src.includes('amazonaws'))) {
      const alt = $(img).attr('alt') || '';
      if (!images.find((i) => i.url === src)) {
        images.push({ url: src, alt });
      }
    }
  });

  $('image', 'svg').each((_, img) => {
    const href = $(img).attr('href') || $(img).attr('xlink:href');
    if (href && (href.includes('scontent') || href.includes('fbcdn'))) {
      if (!images.find((i) => i.url === href)) {
        images.push({ url: href });
      }
    }
  });

  return images;
}

function normalizeImageUrl(url: string): string {
  if (url.includes('_nc_big_')) {
    return url.replace(/_nc_big_/g, '_nc_');
  }
  if (url.includes('_nc_adid=')) {
    const baseUrl = url.split('?')[0];
    return baseUrl;
  }
  return url;
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

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('facebook.com')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Facebook URL' },
        { status: 400 }
      );
    }

    const session = await prisma.session.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!session?.fbCookies) {
      return NextResponse.json(
        { success: false, error: 'Please login first' },
        { status: 401 }
      );
    }

    const cookies = JSON.parse(session.fbCookies);
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

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(normalizedCookies);

    const page = await context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    } catch {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      } catch (e) {
        console.log('Navigation timeout, trying to continue anyway');
      }
    }

    await page.waitForTimeout(3000);

    let images: FacebookImage[] = [];
    let title = '';

    try {
      const postSelectors = [
        '[data-pagelet*="FeedUnit"]',
        '[data-pagelet*="permalink"]',
        '[role="article"]',
        '[data-ad-preview="message"]',
        '.userContentWrapper',
        '[data-testid="post_message"]',
        'div[aria-label*="bài viết"]',
        'div[data-pagelet*="Story"]',
      ];

      let postFound = false;
      for (const selector of postSelectors) {
        try {
          const postElement = await page.$(selector);
          if (postElement) {
            const postHtml = await postElement.innerHTML();
            if (postHtml && postHtml.length > 100) {
              images = extractImagesFromPost(postHtml);
              postFound = true;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (!postFound || images.length === 0) {
        console.log('No post element found with specific selectors, falling back to full page');
        const html = await page.content();
        images = extractImagesFromHtml(html);
      }

      images = images.filter(img => {
        const url = normalizeImageUrl(img.url);
        return url.includes('scontent') || url.includes('fbcdn');
      });

      const seenUrls = new Set<string>();
      images = images.filter(img => {
        const normalizedUrl = normalizeImageUrl(img.url);
        if (seenUrls.has(normalizedUrl)) return false;
        seenUrls.add(normalizedUrl);
        return true;
      });

      const settings = await prisma.settings.findUnique({ where: { id: 'default' } });
      const minWidth = settings?.minImageWidth || 0;
      const minHeight = settings?.minImageHeight || 0;

      if (minWidth > 0 || minHeight > 0) {
        const originalCount = images.length;
        images = images.filter(img => {
          if (!img.width || !img.height) return true;
          return img.width >= minWidth && img.height >= minHeight;
        });
        console.log(`Filtered ${originalCount - images.length} low-quality images (min: ${minWidth}x${minHeight})`);
      }

    } catch (e) {
      console.log('Error extracting post images:', e);
      const html = await page.content();
      images = extractImagesFromHtml(html);
    }

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
          images: images.map((img) => ({ url: normalizeImageUrl(img.url), alt: img.alt })),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      viewId: viewHistory.id,
      postId,
      imagesCount: images.length,
      images: images.map(img => ({ ...img, url: normalizeImageUrl(img.url) })),
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
