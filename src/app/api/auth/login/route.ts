import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { facebookLogin } from '@/lib/facebook-login';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await facebookLogin(email, password);

    if (result.success && result.cookies && result.user) {
      await prisma.session.deleteMany({});
      
      await prisma.session.create({
        data: {
          fbCookies: JSON.stringify(result.cookies),
          fbToken: result.token || null,
          userId: result.user.id,
          userName: result.user.name,
          userAvatar: result.user.avatar || null,
          expiresAt: result.expiresAt || null,
        },
      });

      return NextResponse.json({
        success: true,
        user: result.user,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error || 'Login failed',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
