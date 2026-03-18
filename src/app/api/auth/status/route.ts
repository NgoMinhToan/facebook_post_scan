import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await prisma.session.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (session && (session.fbToken || session.fbCookies)) {
      return NextResponse.json({
        isLoggedIn: true,
        user: {
          id: session.userId || 'unknown',
          name: session.userName || 'Facebook User',
          avatar: session.userAvatar || null,
        },
      });
    }

    return NextResponse.json({ isLoggedIn: false });
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json({ isLoggedIn: false });
  }
}
