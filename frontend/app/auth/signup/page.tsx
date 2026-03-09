'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { Avatar } from '@/components/ui/Avatar';
import { getAvatarColor } from '@/lib/utils/avatarColor';

function SignupForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '';
  const isSafeRedirect = (() => {
    try { return new URL(rawRedirect, window.location.origin).origin === window.location.origin; }
    catch { return false; }
  })();
  const redirect = isSafeRedirect ? rawRedirect : '/dashboard';
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const avatarColor = email ? getAvatarColor(email) : '#4F46E5';

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim(), avatar_color: avatarColor } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      router.push(redirect);
    } else {
      setLoading(false);
      setConfirmEmail(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <img src="/favicon.ico" alt="Logo" className="h-8 w-8" />
          <span className="text-xl font-semibold text-gray-900 dark:text-white">GraphSense</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create account</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Already have an account?{' '}
          <Link href={`/auth/login?redirect=${encodeURIComponent(redirect)}`} className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>

        {confirmEmail ? (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Check your email</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display name
              </label>
              <div className="flex items-center gap-2">
                <Avatar
                  displayName={displayName || (email ? email.split('@')[0] : '?')}
                  avatarColor={avatarColor}
                  size="sm"
                />
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                  placeholder="How others will see you"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Avatar color is based on your email — you can change it later.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
