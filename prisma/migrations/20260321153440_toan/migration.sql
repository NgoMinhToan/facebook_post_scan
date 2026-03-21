-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fbToken" TEXT,
    "fbCookies" TEXT,
    "userId" TEXT,
    "userName" TEXT,
    "userAvatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "ViewHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "metadata" TEXT,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DownloadHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "viewHistoryId" TEXT,
    "postUrl" TEXT NOT NULL,
    "postTitle" TEXT,
    "folderPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "imagesCount" INTEGER NOT NULL,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL,
    "folderExists" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "downloadPath" TEXT NOT NULL DEFAULT './downloads',
    "defaultFormat" TEXT NOT NULL DEFAULT 'zip',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "minImageWidth" INTEGER NOT NULL DEFAULT 0,
    "minImageHeight" INTEGER NOT NULL DEFAULT 0,
    "maxPostsInGroup" INTEGER NOT NULL DEFAULT 10,
    "maxImagesInPost" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" DATETIME NOT NULL
);
