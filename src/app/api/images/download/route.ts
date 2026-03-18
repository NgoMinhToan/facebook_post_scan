import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ImageData {
  url: string;
  alt?: string;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch {
    return null;
  }
}

function getFileExtension(url: string): string {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match) {
    const ext = match[1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return ext === 'jpg' ? 'jpeg' : ext;
    }
  }
  return 'jpeg';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const viewId = searchParams.get('viewId');

    if (!viewId) {
      return NextResponse.json(
        { success: false, error: 'View ID required' },
        { status: 400 }
      );
    }

    const viewHistory = await prisma.viewHistory.findUnique({
      where: { id: viewId },
    });

    if (!viewHistory) {
      return NextResponse.json(
        { success: false, error: 'View not found' },
        { status: 404 }
      );
    }

    let images: ImageData[] = [];
    if (viewHistory.metadata) {
      try {
        const metadata = JSON.parse(viewHistory.metadata);
        images = metadata.images || [];
      } catch {
        images = [];
      }
    }

    return NextResponse.json({
      success: true,
      view: viewHistory,
      images,
    });
  } catch (error) {
    console.error('Get images error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get images' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { viewId, format = 'zip', fileName, imageUrls } = await request.json();

    if (!viewId) {
      return NextResponse.json(
        { success: false, error: 'View ID required' },
        { status: 400 }
      );
    }

    const settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    const viewHistory = await prisma.viewHistory.findUnique({
      where: { id: viewId },
    });

    if (!viewHistory) {
      return NextResponse.json(
        { success: false, error: 'View not found' },
        { status: 404 }
      );
    }

    let images: ImageData[] = [];
    if (viewHistory.metadata) {
      try {
        const metadata = JSON.parse(viewHistory.metadata);
        images = metadata.images || [];
      } catch {
        images = [];
      }
    }

    if (imageUrls && imageUrls.length > 0) {
      images = imageUrls.map((url: string) => ({ url }));
    }

    if (images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images to download' },
        { status: 400 }
      );
    }

    const downloadDir = settings?.downloadPath || './downloads';
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const postDir = path.join(downloadDir, `post_${uniqueId}_${timestamp}`);
    
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    const downloadHistory = await prisma.downloadHistory.create({
      data: {
        viewHistoryId: viewId,
        postUrl: viewHistory.url,
        postTitle: viewHistory.title || undefined,
        folderPath: postDir,
        fileName: `${fileName || viewHistory.title || 'download'}_${timestamp}.${format}`,
        fileFormat: format,
        imagesCount: images.length,
        status: 'downloading',
      },
    });

    const zip = new JSZip();
    const imgFolder = zip.folder('images');

    let downloadedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const ext = getFileExtension(image.url);
      const fileNameInZip = `${String(i + 1).padStart(4, '0')}.${ext}`;

      const buffer = await downloadImage(image.url);
      if (buffer) {
        imgFolder?.file(fileNameInZip, buffer);
        downloadedCount++;
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const finalFileName = `${fileName || viewHistory.title || 'download'}_${timestamp}.${format}`;
    const outputPath = path.join(postDir, finalFileName);

    fs.writeFileSync(outputPath, zipBuffer);

    await prisma.downloadHistory.update({
      where: { id: downloadHistory.id },
      data: {
        status: 'completed',
        fileSize: zipBuffer.length,
        folderExists: fs.existsSync(postDir),
      },
    });

    return NextResponse.json({
      success: true,
      downloadId: downloadHistory.id,
      filePath: outputPath,
      fileName: finalFileName,
      imagesDownloaded: downloadedCount,
      fileSize: zipBuffer.length,
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download images' },
      { status: 500 }
    );
  }
}
