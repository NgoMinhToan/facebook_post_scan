# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# Dùng ci để đảm bảo đúng version từ lock file
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx prisma generate && \
    npx playwright install chromium && \
    npm run build

# Stage 3: Runner (Tối ưu dung lượng & Quyền Root)
FROM node:20-alpine AS runner
WORKDIR /app

# Gộp các thư viện hệ thống và dọn dẹp cache apk ngay lập tức
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libstdc++ \
    libgcc

# Cài Prisma CLI và xóa cache npm để giảm dung lượng image
RUN npm install -g prisma@5.15.0 && npm cache clean --force

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy các thành phần thiết yếu từ Builder
# Chế độ standalone của Next.js đã bao gồm node_modules cần thiết cho app chạy
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /ms-playwright /ms-playwright

# Chỉ copy thêm engine của Prisma nếu bản standalone bị thiếu
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000

# Chạy trực tiếp với quyền Root
CMD ["sh", "-c", "prisma db push --schema ./prisma/schema.prisma && node server.js"]