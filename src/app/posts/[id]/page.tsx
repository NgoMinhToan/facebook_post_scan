'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Download, ArrowLeft, Image, Trash2, FolderOpen, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatBytes } from '@/lib/utils';

interface ImageItem {
  url: string;
  alt?: string;
  selected?: boolean;
}

interface ViewData {
  id: string;
  url: string;
  type: string;
  title: string;
  imagesCount: number;
  createdAt: string;
  metadata?: string;
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [view, setView] = useState<ViewData | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadName, setDownloadName] = useState('');
  const [fileFormat, setFileFormat] = useState('zip');
  const [downloadResult, setDownloadResult] = useState<any>(null);

  useEffect(() => {
    fetchViewData();
  }, [resolvedParams.id]);

  const fetchViewData = async () => {
    try {
      const res = await fetch(`/api/images/download?viewId=${resolvedParams.id}`);
      const data = await res.json();
      
      if (data.success) {
        setView(data.view);
        const imageList = data.images || [];
        setImages(imageList);
        setSelectedImages(new Set(imageList.map((_: any, i: number) => i)));
        setDownloadName(data.view.title || 'download');
      }
    } catch (error) {
      console.error('Failed to fetch view:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImage = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedImages(newSelected);
  };

  const selectAll = () => {
    setSelectedImages(new Set(images.map((_, i) => i)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleDownload = async () => {
    if (selectedImages.size === 0) {
      alert('Vui lòng chọn ít nhất một ảnh');
      return;
    }

    setIsDownloading(true);
    setDownloadResult(null);

    try {
      const selectedUrls = images
        .filter((_, i) => selectedImages.has(i))
        .map((img) => img.url);

      const res = await fetch('/api/images/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId: resolvedParams.id,
          format: fileFormat,
          fileName: downloadName,
          imageUrls: selectedUrls,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setDownloadResult(data);
      } else {
        alert(data.error || 'Download failed');
      }
    } catch (error) {
      alert('Download failed');
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Không tìm thấy bài viết</p>
        <Button onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay về Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-semibold">{view.title || 'Post Detail'}</h1>
                <p className="text-xs text-muted-foreground">
                  {images.length} ảnh • {view.type}
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Danh sách ảnh ({images.length})</CardTitle>
                  <CardDescription>
                    Đã chọn: {selectedImages.size} ảnh
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Chọn tất cả
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Bỏ chọn tất cả
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Không có ảnh nào được tìm thấy
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {images.map((img, index) => (
                      <div
                        key={index}
                        className={cn(
                          'relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition-all',
                          selectedImages.has(index)
                            ? 'border-primary'
                            : 'border-transparent opacity-70'
                        )}
                        onClick={() => toggleImage(index)}
                      >
                        <img
                          src={img.url}
                          alt={img.alt || `Image ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {selectedImages.has(index) && (
                          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                          <span className="text-xs text-white">
                            {String(index + 1).padStart(4, '0')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tải xuống</CardTitle>
                <CardDescription>
                  Đóng gói {selectedImages.size} ảnh đã chọn
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="downloadName">Tên file</Label>
                  <Input
                    id="downloadName"
                    value={downloadName}
                    onChange={(e) => setDownloadName(e.target.value)}
                    placeholder="Nhập tên file"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="format">Định dạng</Label>
                  <select
                    id="format"
                    value={fileFormat}
                    onChange={(e) => setFileFormat(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="zip">ZIP (.zip)</option>
                    <option value="cbz">CBZ (.cbz)</option>
                  </select>
                </div>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading || selectedImages.size === 0}
                  className="w-full"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Tải xuống ({selectedImages.size} ảnh)
                    </>
                  )}
                </Button>

                {downloadResult && (
                  <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm">
                    <p className="font-medium text-green-700">Tải thành công!</p>
                    <p className="mt-1 text-green-600">
                      File: {downloadResult.fileName}
                    </p>
                    <p className="text-green-600">
                      Kích thước: {formatBytes(downloadResult.fileSize)}
                    </p>
                    <p className="text-green-600">
                      Ảnh đã tải: {downloadResult.imagesDownloaded}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Thông tin bài viết</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loại:</span>
                  <span className="font-medium capitalize">{view.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Số ảnh:</span>
                  <span className="font-medium">{view.imagesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ngày quét:</span>
                  <span className="font-medium">
                    {new Date(view.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-muted-foreground">URL:</span>
                  <p className="mt-1 break-all text-xs">{view.url}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
