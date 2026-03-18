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

interface PostData {
  id: string;
  url: string;
  title?: string;
  images: FacebookImage[];
  type: 'post' | 'group' | 'page';
}

function extractPostId(url: string): string | null {
  const patterns = [
    /facebook\.com\/.*?\/posts\/([\w]+)/i,
    /facebook\.com\/photo\/?\?fbid=([\w]+)/i,
    /facebook\.com\/.*?\/([\w]{10,})/i,
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

  const styleImages = html.match(/url\(['"]([^'"]+)['"]\)/g);
  if (styleImages) {
    styleImages.forEach((match) => {
      const url = match.replace(/url\(['"]([^'"]+)['"]\)/, '$1');
      if (url.includes('scontent') || url.includes('fbcdn')) {
        if (!images.find((i) => i.url === url)) {
          images.push({ url });
        }
      }
    });
  }

  return images;
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

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    await page.waitForTimeout(3000);

    const html = await page.content();
    const images = extractImagesFromHtml(html);

    let title = '';
    const titleElement = await page.$('h1 span');
    if (titleElement) {
      title = await titleElement.textContent() || '';
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
          images: images.map((img) => ({ url: img.url, alt: img.alt })),
        }),
      },
    });

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
