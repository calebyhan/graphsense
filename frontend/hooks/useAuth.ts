'use client';

import { useEffect, useState } from 'react';
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
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
          return;
        }

        setAuthState({
          user: session?.user || null,
          session,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('Auth initialization error:', err);
        setAuthState(prev => ({
          ...prev,
          error: 'Failed to initialize authentication',
          loading: false
        }));
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);

        setAuthState({
          user: session?.user || null,
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

  const signInAnonymously = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
        return { user: null, error };
      }

      return { user: data.user, error: null };
    } catch (err) {
      const errorMessage = 'Failed to sign in anonymously';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { user: null, error: new Error(errorMessage) };
    }
  };

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthState(prev => ({ ...prev, error: error.message, loading: false }));
        return { error };
      }

      setAuthState({
        user: null,
        session: null,
        loading: false,
        error: null,
      });

      return { error: null };
    } catch (err) {
      const errorMessage = 'Failed to sign out';
      setAuthState(prev => ({ ...prev, error: errorMessage, loading: false }));
      return { error: new Error(errorMessage) };
    }
  };

  const ensureAuth = async (): Promise<User | null> => {
    if (authState.user) {
      return authState.user;
    }

    if (authState.loading) {
      // Wait for auth to finish loading
      return new Promise((resolve) => {
        const checkAuth = () => {
          if (!authState.loading) {
            resolve(authState.user);
          } else {
            setTimeout(checkAuth, 100);
          }
        };
        checkAuth();
      });
    }

    // Try to sign in anonymously if no user
    const { user } = await signInAnonymously();
    return user;
  };

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