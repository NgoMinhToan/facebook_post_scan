import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { cookies } = await request.json();

    if (!cookies) {
      return NextResponse.json(
        { success: false, error: 'Cookies are required' },
        { status: 400 }
      );
    }

    let parsedCookies = cookies;
    
    if (typeof cookies === 'string') {
      try {
        parsedCookies = JSON.parse(cookies);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid cookies format. Please provide valid JSON.' },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(parsedCookies)) {
      return NextResponse.json(
        { success: false, error: 'Cookies must be an array' },
        { status: 400 }
      );
    }

    const requiredCookies = ['c_user', 'xs', 'fr'];
    const cookieNames = parsedCookies.map((c: any) => c.name);
    const hasRequired = requiredCookies.every(name => cookieNames.includes(name));

    if (!hasRequired) {
      return NextResponse.json({
        success: false,
        error: `Missing required cookies. Need: ${requiredCookies.join(', ')}. Found: ${cookieNames.join(', ')}`,
        required: requiredCookies,
        found: cookieNames
      });
    }

    await prisma.session.deleteMany({});

    const cUser = parsedCookies.find((c: any) => c.name === 'c_user');
    
    await prisma.session.create({
      data: {
        fbCookies: JSON.stringify(parsedCookies),
        userId: cUser?.value || 'unknown',
        userName: 'Facebook User',
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: cUser?.value || 'unknown',
        name: 'Facebook User',
      },
      message: 'Cookies imported successfully',
    });
  } catch (error) {
    console.error('Import cookies error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
