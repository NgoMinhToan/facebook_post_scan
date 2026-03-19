'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const url = searchParams?.get('url') || '';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || url.trim() === '') {
      setError('Missing URL parameter');
      return;
    }

    const doScan = async () => {
      try {
        const res = await fetch('/api/posts/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        
        if (data.success) {
          router.push(`/posts/${data.viewId}`);
        } else {
          setError(data.error || 'Failed to scan post');
        }
      } catch (e) {
        setError('Failed to scan post');
      }
    };

    doScan();
  }, [url, router]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <button 
          onClick={() => router.push('/')}
          className="text-blue-500 hover:underline"
        >
          Quay về Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Đang quét bài viết...</p>
      </div>
    </div>
  );
}