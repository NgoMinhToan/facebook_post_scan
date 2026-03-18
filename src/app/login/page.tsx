'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Image, AlertCircle, Upload, Cookie, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'credentials' | 'cookies'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Đăng nhập thất bại');
      }
    } catch {
      setError('Đã xảy ra lỗi khi đăng nhập');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookiesJson.trim()) {
      setError('Vui lòng dán cookies');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/import-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookies: cookiesJson }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        router.push('/');
      } else {
        setError(data.error || 'Import cookies thất bại');
      }
    } catch {
      setError('Đã xảy ra lỗi khi import cookies');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInstructions = () => {
    const text = `1. Mở Facebook.com trên trình duyệt Chrome/Edge/Firefox
2. Đăng nhập tài khoản của bạn
3. Nhấn F12 để mở Developer Tools
4. Chuyển tab "Application" (Chrome) hoặc "Storage" (Firefox)
5. Tìm "Cookies" > "https://www.facebook.com"
6. Copy các cookies sau:
   - c_user (bắt buộc)
   - xs (bắt buộc)
   - fr (bắt buộc)
   - datr, sb, m_pixel_ratio (khuyến nghị)
7. Dán vào ô bên dưới`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Image className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Facebook Post Scanner</CardTitle>
          <CardDescription>
            Đăng nhập để bắt đầu quét bài viết
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex gap-2">
            <Button
              variant={activeTab === 'credentials' ? 'default' : 'outline'}
              onClick={() => setActiveTab('credentials')}
              className="flex-1"
            >
              <Cookie className="mr-2 h-4 w-4" />
              Tài khoản
            </Button>
            <Button
              variant={activeTab === 'cookies' ? 'default' : 'outline'}
              onClick={() => setActiveTab('cookies')}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              Cookies
            </Button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {activeTab === 'credentials' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email hoặc số điện thoại</Label>
                <input
                  id="email"
                  type="text"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập với Facebook'
                )}
              </Button>
            </form>
          )}

          {activeTab === 'cookies' && (
            <form onSubmit={handleImportCookies} className="space-y-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-blue-900">Hướng dẫn lấy Cookies</h4>
                  <Button variant="ghost" size="sm" onClick={copyInstructions}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <ol className="mt-2 text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Mở <strong>Facebook.com</strong> trên trình duyệt</li>
                  <li>Đăng nhập tài khoản của bạn</li>
                  <li>Nhấn <strong>F12</strong> → tab <strong>Application</strong> (Chrome)</li>
                  <li>Tìm <strong>Cookies</strong> → <strong>facebook.com</strong></li>
                  <li>Copy các cookies: <code className="bg-blue-100 px-1 rounded">c_user</code>, <code className="bg-blue-100 px-1 rounded">xs</code>, <code className="bg-blue-100 px-1 rounded">fr</code></li>
                  <li>Dán vào ô bên dưới (dạng JSON array)</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cookies">Cookies (JSON Array)</Label>
                <Textarea
                  id="cookies"
                  placeholder={`[\n  {"name": "c_user", "value": "...", "domain": ".facebook.com"},\n  {"name": "xs", "value": "...", "domain": ".facebook.com"},\n  {"name": "fr", "value": "...", "domain": ".facebook.com"}\n]`}
                  value={cookiesJson}
                  onChange={(e) => setCookiesJson(e.target.value)}
                  disabled={isLoading}
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Dán cookies dưới dạng JSON array từ DevTools
                </p>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang import...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Cookies
                  </>
                )}
              </Button>
            </form>
          )}
          
          <div className="mt-6 text-center text-xs text-muted-foreground">
            <p>
              Phương thức Cookies an toàn hơn vì không cần nhập mật khẩu.
            </p>
            <p className="mt-1">
              Cookies được mã hóa và lưu trữ cục bộ trên máy bạn.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
