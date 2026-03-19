# Facebook Post Scanner - Tiến Độ Dự Án

**Ngày cập nhật:** 2026-03-19  
**Trạng thái:** ✅ HOÀN THÀNH CƠ BẢN

---

## Tiến Độ Hoàn Thành

### ✅ Phase 1: Setup & Authentication
- [x] Initialize Next.js project với TypeScript
- [x] Setup Prisma với SQLite
- [x] Setup TailwindCSS + shadcn/ui
- [x] Tạo database schema
- [x] Import Cookies login
- [x] Build Dashboard layout

### ✅ Phase 2: Post Scanner  
- [x] API: Scan single post
- [x] Tab navigation để tìm link ảnh (/photo/?fbid=)
- [x] Skip non-photo links (media/set, groups, profile, pages)
- [x] Open Facebook dialog
- [x] Extract images từ SVG elements (HD images)
- [x] ArrowRight navigation để duyệt ảnh tiếp
- [x] Wait for image to load (tối đa 15 giây)
- [x] Loop detection (dừng khi quay lại ảnh đầu)
- [x] Frontend: Image preview grid
- [x] API: Scan group/page posts

### ✅ Phase 3: Download & Packaging
- [x] API: Download images
- [x] API: Create ZIP/CBZ file (using JSZip)
- [x] Frontend: Download modal
- [x] Frontend: Format selection (ZIP/CBZ)
- [x] Frontend: Image selection

### ✅ Phase 4: Dashboard & History
- [x] Dashboard layout
- [x] View history tracking
- [x] Download history tracking
- [x] Folder existence checker
- [x] Delete folder action
- [x] Downloads page với tracking

### ✅ Phase 5: Settings & Polish
- [x] Settings page
- [x] Default path configuration
- [x] Image quality filter (min width/height)
- [x] Error handling nâng cao

---

## Playwright Image Extraction Logic (2026-03-19)

### Luồng xử lý hoàn chỉnh:

```
1. Navigate đến URL bài viết
2. Chờ 5 giây để load hoàn toàn
3. Scroll 5 lần để load content
4. Tab navigation (tối đa 100 lần)
   ├── Tìm link có định dạng /photo/?fbid= → CLICK ✅
   ├── Bỏ qua các link khác:
   │   ├── /media/set/ ❌
   │   ├── /groups/ ❌
   │   ├── /profile/ ❌
   │   ├── /pages/ ❌
   │   └── /status/ ❌
5. Chờ 4 giây cho dialog mở
6. Extract ảnh từ SVG elements (URL HD)
7. Nhấn ArrowRight → Chờ 15 giây cho ảnh mới load
8. Lặp lại cho đến khi quay lại ảnh đầu
9. Nhấn Escape đóng dialog
```

### Image Extraction:
- **Ưu tiên 1:** SVG `image[href*="scontent"]` - Chứa URL ảnh HD gốc
- **Ưu tiên 2:** Image có kích thước lớn
- **Fallback:** Bất kỳ img có scontent nào

---

## Features Đã Implement

### 1. Import Cookies Login
- Lấy cookies từ DevTools (Chrome/Edge/Firefox)
- Cookies cần thiết: c_user, xs, fr
- Lưu trữ cục bộ trong SQLite

### 2. Image Quality Filter
- Không lọc (0x0)
- Thấp (300x300)
- Trung bình (600x400)
- Cao (1200x800)
- Tùy chỉnh thủ công

### 3. Download Options
- Format: ZIP hoặc CBZ
- Tên file tùy chỉnh
- Chọn ảnh để tải

### 4. History & Tracking
- Lịch sử xem bài viết
- Lịch sử tải xuống
- Kiểm tra thư mục tồn tại
- Mở thư mục trong Explorer
- Xóa thư mục

---

## Cấu Trúc Files Hiện Tại

```
facebook_post_scan/
├── prisma/
│   └── schema.prisma          ✅ Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── import-cookies/route.ts ✅ Import cookies
│   │   │   │   ├── logout/route.ts   ✅ Logout API
│   │   │   │   └── status/route.ts   ✅ Auth status
│   │   │   ├── posts/
│   │   │   │   ├── scan/route.ts     ✅ Scan post (Playwright)
│   │   │   │   └── scan-group/route.ts ✅ Scan group
│   │   │   ├── images/
│   │   │   │   └── download/route.ts ✅ Download images
│   │   │   ├── downloads/route.ts    ✅ Download history
│   │   │   ├── folders/route.ts      ✅ Folder management
│   │   │   ├── history/route.ts      ✅ View history
│   │   │   └── settings/route.ts    ✅ Settings API
│   │   ├── downloads/page.tsx        ✅ Downloads page
│   │   ├── login/page.tsx            ✅ Login page (Cookies only)
│   │   ├── posts/[id]/page.tsx       ✅ Post detail
│   │   ├── globals.css                ✅ Global styles
│   │   ├── layout.tsx                ✅ Root layout
│   │   └── page.tsx                  ✅ Dashboard
│   ├── components/ui/
│   │   ├── button.tsx, card.tsx, input.tsx, label.tsx, textarea.tsx
│   └── lib/
│       ├── prisma.ts                 ✅ Prisma client
│       └── utils.ts                  ✅ Utilities
├── package.json                      
├── tsconfig.json                     
├── tailwind.config.ts                
└── next.config.js                   
```

---

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | /api/auth/import-cookies | Import cookies đăng nhập |
| POST | /api/auth/logout | Đăng xuất |
| GET | /api/auth/status | Kiểm tra đăng nhập |
| POST | /api/posts/scan | Quét bài viết (Playwright) |
| POST | /api/posts/scan-group | Quét nhóm/trang |
| GET/POST | /api/images/download | Tải ảnh |
| GET | /api/downloads | Lịch sử tải |
| GET/DELETE | /api/folders | Quản lý thư mục |
| GET/DELETE | /api/history | Lịch sử xem |
| GET/PUT | /api/settings | Cài đặt |

---

## Database Tables

- **Session** - Lưu cookies đăng nhập Facebook
- **ViewHistory** - Lịch sử xem bài viết
- **DownloadHistory** - Lịch sử tải xuống
- **Settings** - Cài đặt (downloadPath, format, imageFilter)

---

## Commands

```bash
# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push

# Run development
npm run dev

# Build production
npm run build

# Lint
npm run lint
```

---

## Issues Đã Fix

### 1. Facebook Login Timeout
- Facebook thay đổi cấu trúc login page
- **Giải pháp:** Loại bỏ đăng nhập bằng mật khẩu, chỉ dùng Cookies

### 2. Image Dialog New Facebook UI
- Facebook dùng dialog mới với hình thu nhỏ
- **Giải pháp:** 
  - Tab navigation để tìm /photo/?fbid= link
  - Skip các link không phải ảnh
  - Click để mở dialog
  - Extract từ SVG elements cho URL HD

### 3. Thumbnail vs HD Image
- URL scontent từ img tag là thumbnail
- **Giải pháp:** Tìm URL trong SVG `image[href]` cho ảnh HD gốc

### 4. ArrowRight Không Nhận Diện Được
- Ảnh load chậm sau khi nhấn ArrowRight
- **Giải pháp:** Wait tối đa 15 giây, kiểm tra URL thay đổi

---

## Next Steps (Optional)

1. [ ] Viết unit tests
2. [ ] Pagination cho lịch sử
3. [ ] Custom file naming patterns
4. [ ] Batch download nhiều bài viết
5. [ ] Proxy rotation để tránh block

---

*Lưu ý: Facebook thường xuyên thay đổi cấu trúc DOM, cần cập nhật scraper định kỳ.*
