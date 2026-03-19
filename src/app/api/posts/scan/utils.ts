import { prisma } from '@/lib/prisma';

export function extractPostId(url: string): string | null {
  const patterns = [
    /facebook\.com\/.*?\/posts\/([\w]+)/i,
    /facebook\.com\/photo\/?\?fbid=([\w]+)/i,
    /pfbid[\w]+/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function getSessionCookies() {
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

export function normalizeCookies(cookies: any[]) {
  return cookies.map((cookie: any) => ({
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
}

export async function getNormalizeCookies() {
  const session = await getSessionCookies();
  if (!session) return null;
  return normalizeCookies(session);
}