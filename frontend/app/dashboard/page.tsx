'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { MyCanvases } from '@/components/dashboard/MyCanvases';
import { SharedCanvases } from '@/components/dashboard/SharedCanvases';

type Tab = 'mine' | 'shared';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'This share link is no longer valid.',
  no_access: "You don't have access to that canvas.",
};

function DashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('mine');
  const [toast, setToast] = useState<string | null>(null);

  const errorParam = searchParams.get('error');
  useEffect(() => {
    if (errorParam && ERROR_MESSAGES[errorParam]) {
      setToast(ERROR_MESSAGES[errorParam]);
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [errorParam]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login?redirect=/dashboard');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navbar */}
      <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shadow-sm">
        <Link href="/" className="flex items-center gap-3">
          <img src="/favicon.ico" alt="Logo" className="h-8 w-8" />
          <span className="text-lg font-semibold text-gray-900 dark:text-white">GraphSense</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">{user.email}</span>
          <button
            onClick={async () => {
              const { supabase } = await import('@/lib/supabase/client');
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-gray-700">
          {([['mine', 'My Canvases'], ['shared', 'Shared with Me']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'mine' ? <MyCanvases /> : <SharedCanvases />}
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
