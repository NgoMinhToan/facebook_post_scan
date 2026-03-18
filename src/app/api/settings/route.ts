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
    const { downloadPath, defaultFormat, theme } = await request.json();

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        ...(downloadPath && { downloadPath }),
        ...(defaultFormat && { defaultFormat }),
        ...(theme && { theme }),
      },
      create: {
        id: 'default',
        downloadPath: downloadPath || './downloads',
        defaultFormat: defaultFormat || 'zip',
        theme: theme || 'light',
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
