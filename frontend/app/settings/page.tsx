'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { AVATAR_COLORS } from '@/lib/utils/avatarColor';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [avatarColor, setAvatarColor] = useState('#4F46E5');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth/login?redirect=/settings');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setAvatarColor(profile.avatar_color);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    const err = await updateProfile({ display_name: trimmed, avatar_color: avatarColor });
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (authLoading || profileLoading || !user) {
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
        <Link
          href="/dashboard"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          Back to dashboard
        </Link>
      </header>

      <main className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Profile settings</h1>

        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Preview */}
          <div className="flex items-center gap-4">
            <Avatar displayName={displayName || '?'} avatarColor={avatarColor} size="lg" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{displayName || 'Your name'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Avatar color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Avatar color
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select avatar color ${color}`}
                  aria-pressed={avatarColor === color}
                  onClick={() => setAvatarColor(color)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  style={{
                    backgroundColor: color,
                    boxShadow: avatarColor === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </main>
    </div>
  );
}
