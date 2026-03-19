'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2, FolderOpen, RefreshCw, Download, XCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatBytes, formatDate } from '@/lib/utils';

interface DownloadItem {
  id: string;
  postUrl: string;
  postTitle: string | null;
  folderPath: string;
  fileName: string;
  fileFormat: string;
  imagesCount: number;
  fileSize: number | null;
  status: string;
  folderExists: boolean;
  createdAt: string;
}

export default function DownloadsPage() {
  const router = useRouter();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDownloads = useCallback(async () => {
    try {
      const res = await fetch('/api/downloads?limit=100');
      const data = await res.json();
      if (data.success) {
        setDownloads(data.downloads);
      }
    } catch (error) {
      console.error('Failed to fetch downloads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDownloads();
    const interval = setInterval(fetchDownloads, 30000);
    return () => clearInterval(interval);
  }, [fetchDownloads]);

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa file này?')) return;
    
    setDeletingId(id);
    try {
      await fetch(`/api/downloads?id=${id}`, { method: 'DELETE' });
      setDownloads(downloads.filter(d => d.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!confirm('Xóa thư mục chứa file này?')) return;
    
    try {
      await fetch(`/api/folders?path=${encodeURIComponent(folderPath)}`, { method: 'DELETE' });
      fetchDownloads();
    } catch (error) {
      console.error('Delete folder failed:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'downloading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Hoàn thành';
      case 'failed': return 'Thất bại';
      case 'downloading': return 'Đang tải';
      default: return 'Đang chờ';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                ← Quay về
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Lịch sử tải xuống</h1>
                <p className="text-sm text-muted-foreground">
                  {downloads.length} file đã tải
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDownloads}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {downloads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Download className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">Chưa có file nào</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Các file bạn tải xuống sẽ xuất hiện ở đây
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {downloads.map((download) => (
              <Card key={download.id} className={cn(
                !download.folderExists && download.status === 'completed' && 'opacity-60'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(download.status)}
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          download.status === 'completed' ? 'bg-green-100 text-green-700' :
                          download.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        )}>
                          {getStatusLabel(download.status)}
                        </span>
                        <span className="font-medium truncate">
                          {download.fileName}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{download.imagesCount} ảnh</span>
                        {download.fileSize && (
                          <span>{formatBytes(download.fileSize)}</span>
                        )}
                        <span className="uppercase">.{download.fileFormat}</span>
                        <span>{formatDate(download.createdAt)}</span>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground truncate">
                        {download.postTitle || download.postUrl}
                      </div>

                      {!download.folderExists && download.status === 'completed' && (
                        <div className="mt-2 text-xs text-orange-500">
                          ⚠️ Thư mục gốc đã bị xóa
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {download.folderExists && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const dir = download.folderPath.replace(/\\/g, '/');
                            window.open(`file://${dir}`);
                          }}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteFolder(download.folderPath)}
                        disabled={deletingId === download.id}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
