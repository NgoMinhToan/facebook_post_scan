import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path');

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: 'Folder path required' },
        { status: 400 }
      );
    }

    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      return NextResponse.json({ success: true, deleted: true });
    }

    return NextResponse.json({ success: true, deleted: false, message: 'Folder not found' });
  } catch (error) {
    console.error('Delete folder error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path');

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: 'Folder path required' },
        { status: 400 }
      );
    }

    const exists = fs.existsSync(folderPath);

    if (!exists) {
      return NextResponse.json({ success: true, exists: false });
    }

    const stats = fs.statSync(folderPath);
    const files = fs.readdirSync(folderPath);

    return NextResponse.json({
      success: true,
      exists: true,
      isDirectory: stats.isDirectory(),
      files: files.length,
      path: folderPath,
    });
  } catch (error) {
    console.error('Check folder error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check folder' },
      { status: 500 }
    );
  }
}
