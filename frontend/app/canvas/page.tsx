'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CanvasIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return null;
}
