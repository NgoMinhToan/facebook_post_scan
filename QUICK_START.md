# Quick Start Guide - Facebook Post Scanner

## For New Developers

### Setup (5 minutes)

```bash
# 1. Navigate to project
cd D:\Project\facebook_post_scan

# 2. Install dependencies
npm install

# 3. Setup database
npx prisma generate
npx prisma db push

# 4. Start development
npm run dev

# 5. Open browser
# http://localhost:3000
```

### How to Test

1. **Login:**
   - Open Chrome/Edge → facebook.com → Login
   - F12 → Application → Cookies → facebook.com
   - Copy cookies array
   - Paste into app login form

2. **Scan Post:**
   - Copy a Facebook post URL
   - Paste into scan form
   - Wait for extraction (30-60 seconds)

3. **Download:**
   - Select images to download
   - Choose format (ZIP/CBZ)
   - Click download

---

## Key Concepts

### 1. Playwright Dialog Extraction
```
Facebook Post URL
    ↓
Tab to find /photo/?fbid= link
    ↓
Click to open dialog
    ↓
Extract from SVG (not img)
    ↓
ArrowRight + wait + repeat
    ↓
Close dialog
```

### 2. Image URL Priority
```
SVG image[href]     → BEST (HD URL)
img src scontent    → OK (may be thumbnail)
```

### 3. Cookie Validation
```
Must have: c_user, xs, fr
Optional: datr, sb
```

---

## Common Tasks

### Add new Facebook selector
Edit `src/app/api/posts/scan/route.ts`:
```typescript
const isPhotoLink = href.includes('/photo/') && href.includes('fbid=');
// Add more patterns here
```

### Add new image selector
```typescript
const svgSelectors = [
  'div[role="dialog"] svg image[href*="scontent"]',
  // Add more selectors here
];
```

### Change timeout
```typescript
// In waitForNewImage function
for (let wait = 0; wait < 15; wait++) { // Increase 15
```

### Enable headless mode
```typescript
const browser = await chromium.launch({ 
  headless: true, // Change from false
});
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Login fails | Re-export cookies from browser |
| No images found | Check post is public or visible to you |
| Loop stops early | Increase waitForNewImage timeout |
| Wrong images | Check SVG selectors priority |

---

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/import-cookies/route.ts  ← Cookie handling
│   │   ├── posts/scan/route.ts          ← Playwright logic
│   │   └── images/download/route.ts     ← ZIP creation
│   ├── login/page.tsx                   ← Login UI
│   └── posts/[id]/page.tsx             ← Preview & download
│   └── page.tsx                         ← Dashboard
└── lib/
    └── utils.ts                         ← Helpers
```

---

## API Quick Reference

```bash
# Login
POST /api/auth/import-cookies
Body: { "cookies": "[...]" }

# Scan
POST /api/posts/scan  
Body: { "url": "https://facebook.com/..." }

# Download
POST /api/images/download
Body: { "viewId": "...", "format": "zip", "imageUrls": [...] }

# Settings
GET/PUT /api/settings
```

---

Questions? Check `PROJECT_DOCUMENTATION.md` for detailed explanation.
