import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          downloadPath: './downloads',
          defaultFormat: 'zip',
          theme: 'light',
          minImageWidth: 0,
          minImageHeight: 0,
          maxPostsInGroup: 10,
          maxImagesInPost: 50,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { downloadPath, defaultFormat, theme, minImageWidth, minImageHeight, maxPostsInGroup, maxImagesInPost } = await request.json();

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        ...(downloadPath !== undefined && { downloadPath }),
        ...(defaultFormat !== undefined && { defaultFormat }),
        ...(theme !== undefined && { theme }),
        ...(minImageWidth !== undefined && { minImageWidth: parseInt(minImageWidth) || 0 }),
        ...(minImageHeight !== undefined && { minImageHeight: parseInt(minImageHeight) || 0 }),
        ...(maxPostsInGroup !== undefined && { maxPostsInGroup: parseInt(maxPostsInGroup) || 10 }),
        ...(maxImagesInPost !== undefined && { maxImagesInPost: parseInt(maxImagesInPost) || 50 }),
      },
      create: {
        id: 'default',
        downloadPath: downloadPath || './downloads',
        defaultFormat: defaultFormat || 'zip',
        theme: theme || 'light',
        minImageWidth: minImageWidth ? parseInt(minImageWidth) : 0,
        minImageHeight: minImageHeight ? parseInt(minImageHeight) : 0,
        maxPostsInGroup: maxPostsInGroup ? parseInt(maxPostsInGroup) : 10,
        maxImagesInPost: maxImagesInPost ? parseInt(maxImagesInPost) : 50,
      },
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
