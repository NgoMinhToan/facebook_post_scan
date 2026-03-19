'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Image, History, Settings, LogOut, FolderOpen, Download, Eye, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface UserInfo {
  id: string;
  name: string;
  avatar: string;
}

interface HistoryItem {
  id: string;
  type: string;
  url: string;
  title: string | null;
  imagesCount: number;
  createdAt: string;
}

interface DownloadStats {
  totalDownloads: number;
  totalImages: number;
  totalSize: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [postUrl, setPostUrl] = useState('');
  const [groupUrl, setGroupUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [downloadStats, setDownloadStats] = useState<DownloadStats>({ totalDownloads: 0, totalImages: 0, totalSize: 0 });
  const [activeTab, setActiveTab] = useState<'scan' | 'history' | 'settings'>('scan');

  useEffect(() => {
    checkAuth();
    fetchHistory();
    fetchDownloadStats();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      if (data.isLoggedIn) {
        setIsLoggedIn(true);
        setUser(data.user);
      } else {
        setIsLoggedIn(false);
      }
    } catch {
      setIsLoggedIn(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history?limit=10');
      const data = await res.json();
      setRecentHistory(data.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const fetchDownloadStats = async () => {
    try {
      const res = await fetch('/api/downloads?limit=100');
      const data = await res.json();
      if (data.downloads) {
        const downloads = data.downloads;
        setDownloadStats({
          totalDownloads: downloads.length,
          totalImages: downloads.reduce((sum: number, d: any) => sum + d.imagesCount, 0),
          totalSize: downloads.reduce((sum: number, d: any) => sum + (d.fileSize || 0), 0),
        });
      }
    } catch (error) {
      console.error('Failed to fetch download stats:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsLoggedIn(false);
      setUser(null);
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleScanPost = async () => {
    if (!postUrl.trim()) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/posts/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: postUrl }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/posts/${data.viewId}`);
      } else {
        alert(data.error || 'Failed to scan post');
      }
    } catch (error) {
      alert('Failed to scan post');
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanGroup = async () => {
    if (!groupUrl.trim()) return;
    setIsScanning(true);
    try {
      const res = await fetch('/api/posts/scan-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: groupUrl }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/posts/${data.viewId}`);
      } else {
        alert(data.error || 'Failed to scan group');
      }
    } catch (error) {
      alert('Failed to scan group');
      console.error(error);
    } finally {
      setIsScanning(false);
    }
  };

  if (isLoggedIn === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isLoggedIn) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold">Facebook Post Scanner</h1>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2">
                  {user.avatar && (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Đăng xuất
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="mb-6 flex gap-2">
              <Button
                variant={activeTab === 'scan' ? 'default' : 'outline'}
                onClick={() => setActiveTab('scan')}
              >
                <Download className="mr-2 h-4 w-4" />
                Quét bài viết
              </Button>
              <Button
                variant={activeTab === 'history' ? 'default' : 'outline'}
                onClick={() => setActiveTab('history')}
              >
                <History className="mr-2 h-4 w-4" />
                Lịch sử
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'outline'}
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Cài đặt
              </Button>
            </div>

            {activeTab === 'scan' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quét bài viết đơn lẻ</CardTitle>
                    <CardDescription>
                      Nhập URL bài viết Facebook để quét và tải ảnh
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.facebook.com/username/posts/..."
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleScanPost} disabled={isScanning}>
                        {isScanning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang quét...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Quét
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quét nhóm/trang</CardTitle>
                    <CardDescription>
                      Nhập URL nhóm hoặc trang Facebook để lấy danh sách bài viết
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://www.facebook.com/groups/... hoặc /pages/..."
                        value={groupUrl}
                        onChange={(e) => setGroupUrl(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={handleScanGroup} disabled={isScanning}>
                        {isScanning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Đang quét...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Quét nhóm
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'history' && (
              <Card>
                <CardHeader>
                  <CardTitle>Lịch sử xem gần đây</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentHistory.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Chưa có lịch sử xem nào
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                                item.type === 'post' ? 'bg-blue-100 text-blue-700' :
                                item.type === 'group' ? 'bg-green-100 text-green-700' :
                                'bg-purple-100 text-purple-700'
                              )}>
                                {item.type}
                              </span>
                              <span className="text-sm text-muted-foreground truncate">
                                {item.title || item.url}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(item.createdAt).toLocaleString('vi-VN')} • {item.imagesCount} ảnh
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/posts/${item.id}`)}
                          >
                            Xem chi tiết
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'settings' && (
              <SettingsCard />
            )}
          </div>

          <div>
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tổng bài viết đã quét</span>
                  <span className="font-medium">{recentHistory.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tổng ảnh đã tải</span>
                  <span className="font-medium">
                    {recentHistory.reduce((sum, h) => sum + h.imagesCount, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tổng file đã tải</span>
                  <span className="font-medium">{downloadStats.totalDownloads}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Liên kết nhanh</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  onClick={() => router.push('/downloads')}
                >
                  <HardDrive className="mr-2 h-4 w-4" />
                  Lịch sử tải xuống
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard() {
  const [downloadPath, setDownloadPath] = useState('./downloads');
  const [defaultFormat, setDefaultFormat] = useState('zip');
  const [minWidth, setMinWidth] = useState('0');
  const [minHeight, setMinHeight] = useState('0');
  const [maxPostsInGroup, setMaxPostsInGroup] = useState('10');
  const [maxImagesInPost, setMaxImagesInPost] = useState('50');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.settings) {
          setDownloadPath(data.settings.downloadPath);
          setDefaultFormat(data.settings.defaultFormat);
          setMinWidth(String(data.settings.minImageWidth || 0));
          setMinHeight(String(data.settings.minImageHeight || 0));
          setMaxPostsInGroup(String(data.settings.maxPostsInGroup || 10));
          setMaxImagesInPost(String(data.settings.maxImagesInPost || 50));
        }
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          downloadPath, 
          defaultFormat,
          minImageWidth: parseInt(minWidth) || 0,
          minImageHeight: parseInt(minHeight) || 0,
          maxPostsInGroup: parseInt(maxPostsInGroup) || 10,
          maxImagesInPost: parseInt(maxImagesInPost) || 50,
        }),
      });
      alert('Đã lưu cài đặt!');
    } catch {
      alert('Lỗi khi lưu cài đặt');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cài đặt</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="downloadPath">Thư mục lưu ảnh</Label>
          <Input
            id="downloadPath"
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            placeholder="./downloads"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="format">Định dạng mặc định</Label>
          <select
            id="format"
            value={defaultFormat}
            onChange={(e) => setDefaultFormat(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="zip">ZIP (.zip)</option>
            <option value="cbz">CBZ (.cbz)</option>
          </select>
        </div>
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Lọc chất lượng ảnh</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Chỉ giữ lại ảnh có độ phân giải tối thiểu. Đặt 0 để không lọc.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="minWidth">Chiều rộng tối thiểu (px)</Label>
              <Input
                id="minWidth"
                type="number"
                min="0"
                value={minWidth}
                onChange={(e) => setMinWidth(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minHeight">Chiều cao tối thiểu (px)</Label>
              <Input
                id="minHeight"
                type="number"
                min="0"
                value={minHeight}
                onChange={(e) => setMinHeight(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMinWidth('0'); setMinHeight('0'); }}
            >
              Không lọc (0x0)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMinWidth('300'); setMinHeight('300'); }}
            >
              Thấp (300x300)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMinWidth('600'); setMinHeight('400'); }}
            >
              Trung bình (600x400)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMinWidth('1200'); setMinHeight('800'); }}
            >
              Cao (1200x800)
            </Button>
          </div>
        </div>
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3">Giới hạn quét</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maxPostsInGroup">Số bài viết (Group/Page)</Label>
              <Input
                id="maxPostsInGroup"
                type="number"
                min="1"
                max="100"
                value={maxPostsInGroup}
                onChange={(e) => setMaxPostsInGroup(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxImagesInPost">Số ảnh (Post)</Label>
              <Input
                id="maxImagesInPost"
                type="number"
                min="1"
                max="200"
                value={maxImagesInPost}
                onChange={(e) => setMaxImagesInPost(e.target.value)}
                placeholder="50"
              />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMaxPostsInGroup('5'); setMaxImagesInPost('20'); }}
            >
              Ít (5 bài, 20 ảnh)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMaxPostsInGroup('10'); setMaxImagesInPost('50'); }}
            >
              Trung bình (10 bài, 50 ảnh)
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => { setMaxPostsInGroup('20'); setMaxImagesInPost('100'); }}
            >
              Nhiều (20 bài, 100 ảnh)
            </Button>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            'Lưu cài đặt'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
