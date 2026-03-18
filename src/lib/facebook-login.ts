import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface LoginResult {
  success: boolean;
  cookies?: any[];
  token?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  expiresAt?: Date;
  error?: string;
}

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

const EMAIL_SELECTORS = [
  '#email',
  'input[name="email"]',
  'input[type="text"][id*="email"]',
  'input[id*="email"][type="text"]',
  'input[autocomplete="username"]',
  'input[data-testid="royal_email"]',
  // mbasic selectors
  'input[name="email"]',
  'input[id="m_login_email"]',
  'input[placeholder*="email" i]',
];

const PASSWORD_SELECTORS = [
  '#pass',
  'input[name="pass"]',
  'input[type="password"][id*="pass"]',
  'input[id*="pass"][type="password"]',
  'input[autocomplete="current-password"]',
  'input[data-testid="royal_pass"]',
  // mbasic selectors
  'input[name="pass"]',
  'input[id="login_form_password"]',
  'input[placeholder*="password" i]',
];

const LOGIN_BUTTON_SELECTORS = [
  'button[name="login"]',
  'button[type="submit"]',
  'input[type="submit"]',
  '[data-testid="royal_login_button"]',
  'button[class*="login"]',
  // mbasic selectors
  'button[name="login"]',
  'input[type="submit"][value*="Log"]',
  'a[href*="login"][role="button"]',
];

async function findElement(page: Page, selectors: string[], timeout = 5000) {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout })) {
        return { element, selector };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function facebookLogin(email: string, password: string): Promise<LoginResult> {
  let browser: Browser | null = null;

  try {
    console.log('Starting Facebook login...');
    
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    const context: BrowserContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'vi-VN',
    });

    const page: Page = await context.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    // Navigate to Facebook
    console.log('Navigating to Facebook...');
    
    // Try mobile version first - it's more stable for automation
    try {
      await page.goto('https://mbasic.facebook.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
    } catch {
      // Fallback to main site
      await page.goto('https://www.facebook.com/login', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
    }

    // Wait a bit for page to settle
    await page.waitForTimeout(2000);

    // Check if already logged in
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (!currentUrl.includes('facebook.com') || currentUrl.includes('/login')) {
      // Try to find email input
      console.log('Looking for login form...');
      
      const emailResult = await findElement(page, EMAIL_SELECTORS);
      const passResult = await findElement(page, PASSWORD_SELECTORS);

      if (!emailResult) {
        // Maybe Facebook shows cookie consent first
        console.log('Looking for cookie consent...');
        const acceptBtn = page.locator('button[title="Accept"], button:has-text("Accept"), [data-testid="cookie-policy-dialog-accept"]').first();
        if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await acceptBtn.click();
          await page.waitForTimeout(1000);
        }
        
        // Try again
        const emailResult2 = await findElement(page, EMAIL_SELECTORS);
        if (!emailResult2) {
          throw new Error('Could not find email input field. Facebook may have changed their login page.');
        }
      }

      const passElement = passResult?.element || page.locator(PASSWORD_SELECTORS[1]).first();
      
      // Fill email
      console.log('Filling email...');
      await page.locator(EMAIL_SELECTORS[0]).fill(email);
      await page.waitForTimeout(500);
      
      // Fill password
      console.log('Filling password...');
      const passSelectors = PASSWORD_SELECTORS.filter(s => s !== '#pass');
      for (const selector of passSelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.fill(password);
            break;
          }
        } catch {
          continue;
        }
      }
      
      await page.waitForTimeout(500);

      // Find and click login button
      console.log('Clicking login button...');
      let loginClicked = false;
      for (const selector of LOGIN_BUTTON_SELECTORS) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click();
            loginClicked = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!loginClicked) {
        // Try pressing Enter
        await page.keyboard.press('Enter');
      }

      // Wait for navigation
      console.log('Waiting for login...');
      await page.waitForTimeout(5000);
    }

    // Check login result
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // If still on login page, check for errors
    if (finalUrl.includes('/login')) {
      // Check for error messages on page
      const errorText = await page.locator('div[role="alert"], [data-testid="home_stream"]').textContent().catch(() => '') || '';
      if (errorText.includes('incorrect') || errorText.includes('wrong') || errorText.includes('sai')) {
        throw new Error('Login failed: Incorrect email or password.');
      }
    }
    
    // Check for login errors or 2FA
    if (finalUrl.includes('login_attempts') || 
        finalUrl.includes('checkpoint') ||
        finalUrl.includes('two_factor')) {
      throw new Error('Login failed: Facebook requires additional verification (2FA or checkpoint). Please try again later.');
    }

    // Login should be successful if we're not on a login page
    const isLoggedIn = !finalUrl.includes('/login');

    if (!isLoggedIn) {
      // Try one more time - maybe it just needs more time
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login failed: Could not complete login. Please check your credentials.');
      }
    }

    // Check if we're logged in
    const emailInputStillVisible = await page.locator(EMAIL_SELECTORS[0]).isVisible().catch(() => false);
    if (emailInputStillVisible) {
      throw new Error('Login failed: Email field still visible. Check your credentials.');
    }

    // Get cookies BEFORE closing browser
    console.log('Extracting cookies...');
    const cookies: Cookie[] = await context.cookies();
    
    // Extract user info from cookies
    let user = { id: 'unknown', name: 'Facebook User' };
    let avatar = '';

    try {
      // Try to get user ID from cookies (c_user cookie)
      const cUserCookie = cookies.find((c: Cookie) => c.name === 'c_user');
      if (cUserCookie) {
        user.id = cUserCookie.value;
      }
      
      // Try to get user name from the page
      const nameSelectors = [
        'span[data-testid="user_name"]',
        'span[class*="user"]',
        'a[href*="/user/"] span',
        'div[data-pagelet="ProfileAvatar"] + span',
        '[role="navigation"] a[href*="?__xt"]',
        'div[aria-label*="Avatar"] + span',
        'a[href*="facebook.com/"][role="link"] span',
      ];
      
      for (const selector of nameSelectors) {
        try {
          const nameEl = page.locator(selector).first();
          if (await nameEl.isVisible({ timeout: 2000 })) {
            const name = await nameEl.textContent();
            if (name && name.trim() && name.trim().length > 1 && name.trim().length < 50) {
              user.name = name.trim();
              break;
            }
          }
        } catch {
          continue;
        }
      }

      // Get avatar
      const avatarSelectors = [
        'image[class*="profile"]',
        'img[data-testid="profilePic"]',
        'img[class*="avatar"]',
        '[role="navigation"] img',
      ];
      
      for (const selector of avatarSelectors) {
        try {
          const img = page.locator(selector).first();
          if (await img.isVisible({ timeout: 2000 })) {
            const src = await img.getAttribute('src');
            if (src && !src.includes('data:')) {
              avatar = src;
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (e) {
      console.log('Could not extract user info:', e);
    }

    console.log('Login successful. User:', user.name, 'ID:', user.id);

    await browser.close();

    return {
      success: true,
      cookies: cookies,
      user,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
  } catch (error: any) {
    console.error('Facebook login error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore
      }
    }

    return {
      success: false,
      error: error.message || 'Login failed. Please check your credentials and try again.',
    };
  }
}

export async function verifyCookies(cookies: any[]): Promise<boolean> {
  if (!cookies || cookies.length === 0) return false;

  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.addCookies(cookies);
    
    const page = await context.newPage();
    await page.goto('https://www.facebook.com', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Check if still logged in by looking for email input
    const emailInput = page.locator(EMAIL_SELECTORS[0]);
    const isVisible = await emailInput.isVisible().catch(() => true);
    const isLoggedIn = !isVisible;
    
    await browser.close();
    
    return isLoggedIn;
  } catch {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore
      }
    }
    return false;
  }
}
