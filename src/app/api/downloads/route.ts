import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const downloads = await prisma.downloadHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const downloadsWithStatus = downloads.map((d) => ({
      ...d,
      folderExists: fs.existsSync(d.folderPath),
    }));

    return NextResponse.json({
      success: true,
      downloads: downloadsWithStatus,
      total: downloads.length,
    });
  } catch (error) {
    console.error('Get downloads error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get downloads' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID required' },
        { status: 400 }
      );
    }

    const download = await prisma.downloadHistory.findUnique({
      where: { id },
    });

    if (download) {
      if (fs.existsSync(download.folderPath)) {
        fs.rmSync(download.folderPath, { recursive: true, force: true });
      }
    }

    await prisma.downloadHistory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete download' },
      { status: 500 }
    );
  }
}
