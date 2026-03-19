import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

interface PostPreview {
  id: string;
  url: string;
  title: string;
  imagesCount: number;
  date?: string;
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
    const { url, maxPosts = 10 } = await request.json();

    if (!url || !url.includes('facebook.com')) {
      return NextResponse.json(
        { success: false, error: 'Invalid Facebook URL' },
        { status: 400 }
      );
    }

    const cookies = await getSessionCookies();
    if (!cookies) {
      return NextResponse.json(
        { success: false, error: 'Please login first' },
        { status: 401 }
      );
    }

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
    
    console.log('Scanning group/page:', url);
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      console.log('Navigation warning:', e);
    }

    await page.waitForTimeout(2000);
    
    console.log('Scrolling to load posts...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1000);
    }

    let pageTitle = '';
    const titleElement = await page.$('h1 span');
    if (titleElement) {
      pageTitle = await titleElement.textContent() || '';
    }

    const posts: PostPreview[] = [];
    let extractedCount = 0;

    while (extractedCount < maxPosts) {
      const postElements = await page.$$('[role="article"], [data-ad-preview="message"]');
      
      if (postElements.length === 0) break;

      for (const post of postElements) {
        if (extractedCount >= maxPosts) break;

        try {
          const links = await post.$$('a[href*="/posts/"]');
          let postUrl = '';
          
          for (const link of links) {
            const href = await link.getAttribute('href');
            if (href && href.includes('/posts/')) {
              const cleanUrl = href.split('?')[0];
              if (!postUrl || cleanUrl.length < postUrl.length) {
                postUrl = 'https://www.facebook.com' + cleanUrl;
              }
            }
          }

          if (postUrl) {
            const html = await (post as any).innerHTML();
            const $ = cheerio.load(html);
            const imgCount = $('img').length;
            
            const postIdMatch = postUrl.match(/\/posts\/([\w]+)/);
            const postId = postIdMatch ? postIdMatch[1] : String(extractedCount);

            if (!posts.find((p) => p.id === postId)) {
              posts.push({
                id: postId,
                url: postUrl,
                title: `Post ${postId.substring(0, 8)}...`,
                imagesCount: imgCount,
              });
              extractedCount++;
            }
          }
        } catch (e) {
          continue;
        }
      }

      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);
    }

    await browser.close();

    const postType = url.includes('/groups/') ? 'group' : 'page';

    const viewHistory = await prisma.viewHistory.create({
      data: {
        url,
        type: postType,
        title: pageTitle.substring(0, 255) || url,
        imagesCount: posts.reduce((sum, p) => sum + p.imagesCount, 0),
        metadata: JSON.stringify({ posts }),
      },
    });

    return NextResponse.json({
      success: true,
      viewId: viewHistory.id,
      groupName: pageTitle,
      posts,
      totalPosts: posts.length,
    });
  } catch (error) {
    console.error('Scan group error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to scan group' },
      { status: 500 }
    );
  }
}
