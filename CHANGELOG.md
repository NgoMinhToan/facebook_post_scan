# Changelog - Facebook Post Scanner

## 2026-03-19 - Image Extraction Complete

### Fixed
- ✅ Image extraction now works correctly
- ✅ SVG HD image URLs extracted (not thumbnails)
- ✅ ArrowRight navigation with proper wait time
- ✅ Loop detection accurate (waits for image to load)

### Features Added
- Tab navigation to find photo links (/photo/?fbid=)
- Skip non-photo links (media/set, groups, profile, pages)
- Click to open Facebook dialog
- SVG image[href] extraction for HD URLs
- Wait up to 15 seconds for new image to load
- Escape to close dialog

### Technical Changes
- `headless: false` for visibility during debugging
- Viewport 1920x1080 for better visibility
- Multiple SVG selectors in priority order
- Better URL comparison in loop detection

---

## 2026-03-19 - Image Quality Filter

### Added
- Settings page with image quality filter
- Min width/height filter options:
  - None (0x0)
  - Low (300x300)
  - Medium (600x400)
  - High (1200x800)
  - Custom manual input

### Database Changes
- Added `minImageWidth` field to Settings
- Added `minImageHeight` field to Settings

---

## 2026-03-19 - Cookies Only Login

### Changed
- Removed password-based login (unstable, Facebook blocks)
- Only cookies import supported
- Simpler login page (single tab)

### Files Removed
- `/api/auth/login/route.ts` (password login)
- `/src/lib/facebook-login.ts` (playwright auto-login)

### Files Added
- `/api/auth/import-cookies/route.ts` (cookies only)

---

## 2026-03-18 - Initial Project Setup

### Created
- Next.js 14 with TypeScript
- Prisma + SQLite database
- TailwindCSS + shadcn/ui components
- Dashboard layout
- Login page
- Post detail page
- Downloads history page
- All API routes

### Database Schema
- Session (Facebook login)
- ViewHistory (scanned posts)
- DownloadHistory (downloads)
- Settings (app configuration)

---

## Known Issues

1. Facebook UI changes frequently
   - May need to update selectors
   - Tab order may change
   - Dialog structure may change

2. Image quality
   - SVG extraction works for now
   - Facebook may change to different rendering

3. Cookie expiration
   - Cookies expire after ~90 days
   - May need to re-import periodically

---

## TODO

- [ ] Handle multiple albums in single post
- [ ] Extract from video thumbnails  
- [ ] Batch scanning
- [ ] Custom file naming
- [ ] Proxy rotation
- [ ] Export history
