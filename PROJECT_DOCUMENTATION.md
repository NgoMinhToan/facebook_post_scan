# Facebook Post Scanner - Project Documentation

**Ngày tạo:** 2026-03-19  
**Tác giả:** AI Assistant  
**Mục đích:** Hướng dẫn toàn diện cho AI agents

---

## 1. Tổng Quan Dự Án

### 1.1 Mục tiêu
Xây dựng web application để scan và tải ảnh từ các bài viết Facebook.

### 1.2 Tech Stack
- **Frontend:** Next.js 14 (App Router), React, TypeScript
- **Styling:** TailwindCSS, shadcn/ui components
- **Backend:** Next.js API Routes, Node.js
- **Database:** SQLite với Prisma ORM
- **Browser Automation:** Playwright
- **File Processing:** JSZip

### 1.3 Cấu trúc thư mục
```
facebook_post_scan/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   ├── login/             # Login page
│   │   ├── posts/[id]/        # Post detail page
│   │   ├── downloads/          # Downloads history page
│   │   └── page.tsx           # Dashboard
│   ├── components/ui/          # UI components
│   └── lib/                   # Utilities
├── package.json
└── tsconfig.json
```

---

## 2. Database Schema

### 2.1 Tables

```prisma
model Session {
  id        String    @id @default(cuid())
  fbToken   String?
  fbCookies String?
  userId    String?
  userName  String?
  userAvatar String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  expiresAt DateTime?
}

model ViewHistory {
  id          String   @id @default(cuid())
  url         String
  type        String
  title       String?
  metadata    String?   # JSON chứa images array
  imagesCount Int      @default(0)
  createdAt   DateTime @default(now())
}

model DownloadHistory {
  id            String   @id @default(cuid())
  viewHistoryId String?
  postUrl       String
  postTitle     String?
  folderPath    String
  fileName      String
  fileFormat    String
  imagesCount   Int
  fileSize      Int?
  status        String
  folderExists  Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Settings {
  id            String   @id @default("default")
  downloadPath  String   @default("./downloads")
  defaultFormat String   @default("zip")
  minImageWidth Int      @default(0)
  minImageHeight Int     @default(0)
  theme         String   @default("light")
  updatedAt     DateTime @updatedAt
}
```

---

## 3. Authentication System

### 3.1 Chỉ hỗ trợ Cookies Login

**LÝ DO QUAN TRỌNG:**
- Facebook có cơ chế bảo mật phức tạp (2FA, checkpoint, rate limiting)
- Đăng nhập bằng mật khẩu tự động dễ bị chặn
- Cookies từ trình duyệt đã đăng nhập là cách đáng tin cậy nhất

### 3.2 Cookies cần thiết
```
c_user  - User ID
xs      - Session token
fr      - Frame token
datr    - (khuyến nghị) Datr token
sb      - (khuyến nghị) Sb token
```

### 3.3 Cách lấy Cookies
1. Mở Chrome/Edge → facebook.com → Đăng nhập
2. F12 → Application tab → Cookies → facebook.com
3. Copy các cookies cần thiết
4. Paste vào form import trong app

### 3.4 API Endpoints

```typescript
// POST /api/auth/import-cookies
// Input: { cookies: JSON.stringify(cookiesArray) }
// Validates: c_user, xs, fr cookies must exist
// Output: { success: true, user: {...} }

// POST /api/auth/logout
// Xóa tất cả sessions

// GET /api/auth/status
// Kiểm tra đăng nhập: session.fbToken || session.fbCookies
```

---

## 4. Facebook Post Scanner - Playwright Logic

### 4.1 Tổng quan luồng xử lý

```
┌─────────────────────────────────────────────────────────────┐
│  1. Navigate to Facebook post URL                          │
│     ↓                                                       │
│  2. Wait 5 seconds for page to fully load                   │
│     ↓                                                       │
│  3. Scroll 5 times to load lazy content                     │
│     ↓                                                       │
│  4. Tab navigation to find photo link                       │
│     ↓                                                       │
│  5. Click on /photo/?fbid= link                             │
│     ↓                                                       │
│  6. Wait 4 seconds for dialog to open                       │
│     ↓                                                       │
│  7. Extract HD image URL from SVG elements                   │
│     ↓                                                       │
│  8. Press ArrowRight → Wait for new image (up to 15s)        │
│     ↓                                                       │
│  9. Repeat until loop back to first image                  │
│     ↓                                                       │
│  10. Press Escape to close dialog                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Tab Navigation Logic

**QUAN TRỌNG - Các loại links cần skip:**

```typescript
// PHẢI CLICK - Đây là link ảnh
const isPhotoLink = href.includes('/photo/') && href.includes('fbid=');

// SKIP - Không click vào những links này
const isMediaSet = href.includes('/media/set/');      // Album
const isGroup = href.includes('/groups/');            // Group link
const isProfile = href.match(/\/\d{10,}/) !== null;   // Profile ID
const isPage = href.includes('/pages/');               // Page link
const isStory = href.includes('/status/');             // Status link
```

**Vấn đề đã gặp:**
- Link `/media/set/?vanity=...` có thumbnail ảnh bên trong
- Nếu click vào sẽ mở album thay vì dialog ảnh
- Cần kiểm tra href TRƯỚC khi click, không chỉ kiểm tra có scontent không

### 4.3 SVG Image Extraction

**TẠI SAO CẦN SVG:**
- Facebook dùng SVG để hiển thị ảnh trong dialog
- Thẻ `<img>` trong dialog chỉ chứa thumbnail (URL ngắn)
- Thẻ `<image>` trong SVG chứa URL ảnh HD đầy đủ

```typescript
// Selectors ưu tiên (thứ tự quan trọng)
const svgSelectors = [
  'div[role="dialog"] svg image[href*="scontent"]',
  'div[role="dialog"] svg image[href*="fbcdn"]',
  '[data-pagelet*="MediaViewer"] svg image[href*="scontent"]',
];

// Fallback nếu không có SVG
const imgSelectors = [
  'div[role="dialog"] img[src*="scontent"]',
  'div[role="dialog"] img[src*="fbcdn"]',
];
```

### 4.4 ArrowRight Navigation

**Vấn đề đã gặp:**
- Facebook load ảnh mới CHẬM (có thể 5-10 giây)
- Nếu check ngay sẽ thấy ảnh cũ → loop detection nhầm

**Giải pháp:**
```typescript
const waitForNewImage = async (previousUrl: string): Promise<string | null> => {
  for (let wait = 0; wait < 15; wait++) {
    await page.waitForTimeout(1000);
    const currentUrl = await getDialogImageUrl();
    
    // Chỉ coi là "ảnh mới" nếu URL THAY ĐỔI THỰC SỰ
    const isSame = currentUrl === previousUrl || 
                   currentUrl.includes(previousUrl.split('/').pop() || '');
    
    if (!isSame && currentUrl) {
      return currentUrl; // Ảnh mới đã load
    }
  }
  return null; // Timeout sau 15 giây
};
```

### 4.5 Loop Detection

**Cách hoạt động:**
1. Lưu tất cả URLs đã gặp vào Set
2. Nếu URL mới đã tồn tại trong Set → Dừng
3. Nếu URL mới === URL cũ (sau khi ArrowRight) → Dừng

```typescript
const seenUrls = new Set<string>();

if (!seenUrls.has(cleanUrl)) {
  seenUrls.add(cleanUrl);
  images.push({ url: currentUrl, alt: `Image ${imgCount + 1}` });
} else {
  break; // Đã gặp ảnh này rồi
}
```

---

## 5. Image URL Normalization

### 5.1 Các loại URL ảnh Facebook

```
1. Thumbnail (NHỎ - không nên dùng):
   https://scontent.fsgn5-10.fna.fbcdn.net/v/t39.30808-6/123.jpg?_nc_cat=...

2. Medium:
   https://scontent.fsgn5-10.fna.fbcdn.net/v/t39.30808-6/456_hd.jpg?_nc_cat=...

3. HD (LỚN - nên dùng):
   https://scontent.fsgn5-10.fna.fbcdn.net/v/t39.30808-6/789_1080p.jpg?_nc_cat=...
```

### 5.2 URL patterns

```typescript
// Các patterns cần lọc bỏ
const thumbnailPatterns = [
  /_nc_/g,           // Thumbnail indicator
  /_rsrc=/,          // Resource indicator  
  /&dl=/,            // Download parameter
];

// Clean URL
const cleanUrl = rawUrl
  .split('?')[0]     // Remove query params
  .replace(/_nc_.*?\./, '.'); // Remove _nc_xxx_ in filename
```

---

## 6. Playwright Configuration

### 6.1 Browser Launch Options

```typescript
const browser = await chromium.launch({ 
  headless: false,  // Hiển thị trình duyệt để debug
  args: [
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
});
```

### 6.2 Anti-Detection Measures

```typescript
// 1. Remove automation flags
'--disable-blink-features=AutomationControlled'

// 2. Use real user agent
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...

// 3. Full viewport
1920x1080 (common desktop resolution)
```

---

## 7. API Routes

### 7.1 /api/posts/scan

**Method:** POST  
**Input:** `{ url: string }`  
**Output:**
```json
{
  "success": true,
  "viewId": "cuid...",
  "postId": "786494...",
  "imagesCount": 15,
  "images": [
    { "url": "https://scontent.../image.jpg", "alt": "Image 1" }
  ],
  "title": "Post Title"
}
```

### 7.2 /api/images/download

**Method:** POST  
**Input:**
```json
{
  "viewId": "cuid...",
  "format": "zip",
  "fileName": "custom_name",
  "imageUrls": ["url1", "url2", ...]
}
```

**Output:**
```json
{
  "success": true,
  "filePath": "./downloads/post_xxx.zip",
  "fileName": "custom_name_timestamp.zip",
  "imagesDownloaded": 15,
  "fileSize": 5242880
}
```

### 7.3 /api/settings

**GET:** Lấy settings hiện tại

**PUT:** Cập nhật settings
```json
{
  "downloadPath": "./downloads",
  "defaultFormat": "zip",
  "minImageWidth": 600,
  "minImageHeight": 400
}
```

---

## 8. Cookie Handling

### 8.1 Cookie Format từ DevTools

```json
[
  {
    "name": "c_user",
    "value": "123456789",
    "domain": ".facebook.com",
    "path": "/",
    "expires": 1747654321,
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
  }
]
```

### 8.2 Playwright Cookie Format

```typescript
// Phải normalize trước khi addCookies
const normalizedCookies = cookies.map((cookie: any) => ({
  name: cookie.name,
  value: cookie.value,
  domain: cookie.domain || '.facebook.com',
  path: cookie.path || '/',
  expires: cookie.expires || -1,
  httpOnly: cookie.httpOnly || false,
  secure: cookie.secure !== false,
  sameSite: cookie.sameSite === 'Strict' || cookie.sameSite === 'Lax' || cookie.sameSite === 'None' 
    ? cookie.sameSite 
    : 'Lax',  // Mặc định là 'Lax' nếu không có
}));
```

### 8.3 Lỗi thường gặp

```
Error: cookies[0].sameSite: expected one of (Strict|Lax|None)
```

**Nguyên nhân:** DevTools có thể export `sameSite: "unspecified"` hoặc không có field

**Giải pháp:** Normalize như trên, mặc định là 'Lax'

---

## 9. Common Issues & Solutions

### Issue 1: Cookies not working after import
**Nguyên nhân:** Session không có cả fbToken và fbCookies  
**Kiểm tra:** API status phải check cả 2 fields

### Issue 2: Clicking wrong link
**Nguyên nhân:** Check scontent trước khi check href  
**Giải pháp:** LUÔN kiểm tra href pattern TRƯỚC

### Issue 3: Getting thumbnails instead of HD
**Nguyên nhân:** Lấy URL từ `<img>` thay vì `<svg image>`  
**Giải pháp:** Ưu tiên SVG selectors

### Issue 4: Loop detection too early
**Nguyên nhân:** Check URL quá sớm, ảnh chưa kịp load  
**Giải pháp:** Wait 1-15 giây sau mỗi ArrowRight

### Issue 5: Dialog not opening
**Nguyên nhân:** Page chưa load xong, hoặc click sai element  
**Giải pháp:** Chờ thêm sau khi click, verify dialog xuất hiện

---

## 10. Testing Checklist

### Authentication
- [ ] Import cookies thành công
- [ ] Status API trả về isLoggedIn: true
- [ ] Logout xóa session

### Post Scanner
- [ ] Navigate đến URL
- [ ] Tab đến đúng link ảnh
- [ ] Click mở dialog
- [ ] Extract đúng số ảnh
- [ ] ArrowRight duyệt tiếp
- [ ] Loop detection hoạt động

### Download
- [ ] Tải ảnh thành công
- [ ] ZIP/CBZ đúng format
- [ ] Tên file đúng
- [ ] File size hợp lý

### Settings
- [ ] Image quality filter hoạt động
- [ ] Default format lưu được
- [ ] Download path lưu được

---

## 11. Future Improvements

### High Priority
- [ ] Handle multiple albums in single post
- [ ] Extract images from video thumbnails
- [ ] Retry logic for failed downloads

### Medium Priority
- [ ] Batch scanning multiple posts
- [ ] Custom file naming patterns
- [ ] Pagination for history

### Low Priority
- [ ] Proxy rotation for high volume
- [ ] Export history to CSV
- [ ] Dark mode theme

---

## 12. Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/api/posts/scan/route.ts` | Playwright logic chính |
| `src/app/api/auth/import-cookies/route.ts` | Cookie validation |
| `src/app/api/images/download/route.ts` | Download & ZIP |
| `src/app/login/page.tsx` | Login UI |
| `src/app/posts/[id]/page.tsx` | Image preview & download UI |
| `prisma/schema.prisma` | Database structure |

---

## 13. Debug Tips

### Enable verbose logging
```typescript
console.log(`Tab ${tabCount + 1}: ${href.substring(0, 70)}...`);
console.log(`Found SVG HD image: ${cleanUrl.substring(0, 60)}...`);
```

### Check current URL
```typescript
const currentUrl = await page.url();
console.log('Current URL:', currentUrl);
```

### Inspect DOM
```typescript
const html = await page.content();
// Log ra file để inspect
```

### Manual testing
- Set `headless: false` để thấy trình duyệt
- Add `await page.waitForTimeout(5000)` để debug

---

*Lưu ý quan trọng: Facebook thường xuyên cập nhật giao diện và cơ chế bảo mật. Các selectors và logic trong file này có thể cần được cập nhật theo thời gian.*
