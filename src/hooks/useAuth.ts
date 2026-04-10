import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  displayName: string | null;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    displayName: null,
    isLoading: true,
  });

  useEffect(() => {
    // Check active session on mount
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        setAuthState({
          isAuthenticated: true,
          user: session.user,
          displayName: profile?.display_name ?? null,
          isLoading: false,
        });
      } else {
        setAuthState(s => ({ ...s, isAuthenticated: false, user: null, isLoading: false }));
      }
    };

    getSession();

    // Listen for auth changes (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', session.user.id)
            .maybeSingle();

          setAuthState({
            isAuthenticated: true,
            user: session.user,
            displayName: profile?.display_name ?? null,
            isLoading: false,
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            user: null,
            displayName: null,
            isLoading: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Logout ──────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthState({
      isAuthenticated: false,
      user: null,
      displayName: null,
      isLoading: false,
    });
  }, []);

  // ── Delete current user account ─────────────────────────
  // Note: full deletion requires a Supabase Edge Function or admin key.
  // This signs the user out and removes their profile row.
  const deleteAccount = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Delete profile row
    await supabase.from('profiles').delete().eq('user_id', user.id);

    // Sign out (auth.users row can only be deleted server-side)
    await supabase.auth.signOut();
  }, []);

  return {
    ...authState,
    logout,
    deleteAccount,
  };
}