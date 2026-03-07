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
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe,
    // so no separate getSession() call is needed.
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
    signOut,
    ensureAuth,
  };
}