'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getAvatarColor } from '@/lib/utils/avatarColor';

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
}

/** Fetch and update the current user's profile. Creates the row on first login if missing. */
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_color')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (data) {
        setProfile(data);
        setLoading(false);
        return;
      }

      // No profile row yet — create one from user_metadata (set during signup)
      const meta = user.user_metadata ?? {};
      const display_name: string =
        meta.display_name || user.email?.split('@')[0] || 'User';
      const avatar_color: string =
        meta.avatar_color || getAvatarColor(user.email ?? user.id);

      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: user.id, display_name, avatar_color })
        .select('id, display_name, avatar_color')
        .single();

      if (!cancelled) {
        setProfile(
          created ?? { id: user.id, display_name, avatar_color }
        );
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const updateProfile = useCallback(
    async (updates: { display_name?: string; avatar_color?: string }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select('id, display_name, avatar_color')
        .single();
      if (!error && data) setProfile(data);
      return error;
    },
    [user]
  );

  return { profile, loading, updateProfile };
}

/** Batch-fetch profiles for a list of user IDs. Returns a map of id → Profile. */
export function useProfiles(userIds: string[]) {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) {
      setProfiles({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('profiles')
      .select('id, display_name, avatar_color')
      .in('id', ids)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, Profile> = {};
        for (const p of data ?? []) map[p.id] = p;
        setProfiles(map);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { profiles, loading };
}
