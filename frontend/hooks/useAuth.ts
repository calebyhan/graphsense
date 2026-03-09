'use client';

import { useCallback, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Eagerly read the stored session so `loading` resolves before INITIAL_SESSION
    // fires asynchronously. This eliminates the brief window where child hooks
    // (e.g. useMyCanvases) mount with session=null and skip their first fetch.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev =>
        prev.loading
          ? { user: session?.user ?? null, session, loading: false, error: null }
          : prev
      );
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          error: null,
        });
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInAnonymously = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
        return { user: null, error };
      }
      return { user: data.user, error: null };
    } catch {
      const errorMessage = 'Failed to sign in anonymously';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { user: null, error: new Error(errorMessage) };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
        return { error };
      }
      return { error: null };
    } catch {
      const errorMessage = 'Failed to sign out';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { error: new Error(errorMessage) };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data?.user ?? null, error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { user: data?.user ?? null, error };
  }, []);

  // Calls getSession() directly to avoid reading stale closed-over state.
  const ensureAuth = useCallback(async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
    const { user } = await signInAnonymously();
    return user;
  }, [signInAnonymously]);

  return {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    error: authState.error,
    isAuthenticated: !!authState.user,
    signInAnonymously,
    signIn,
    signUp,
    signOut,
    ensureAuth,
  };
}