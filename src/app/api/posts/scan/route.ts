import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { chromium, Page } from 'playwright';
import { getImageUrlsFromPage } from './image-extractor';
import { FacebookImage } from './types';
import { extractPostId, getNormalizeCookies } from './utils';


async function getTitle(page: Page): Promise<string> {
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
  return title;
}

async function filterValidImageUrls(images: FacebookImage[]) {
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

    const normalizedCookies = await getNormalizeCookies();
    if (!normalizedCookies) {
      return NextResponse.json(
        { success: false, error: 'Please login first' },
        { status: 401 }
      );
    }

    const postId = extractPostId(url);

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
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
    await page.waitForLoadState('load');

    const title = await getTitle(page);

    const images: FacebookImage[] = await getImageUrlsFromPage(page);

    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(500);

    await filterValidImageUrls(images);

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
