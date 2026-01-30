import { useState, useEffect, useCallback } from 'react';

const AUTH_KEY = 'jeanne_jewelry_auth';

interface AuthState {
  isAuthenticated: boolean;
  user: 'mom' | 'dad' | null;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const stored = sessionStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { isAuthenticated: false, user: null };
      }
    }
    return { isAuthenticated: false, user: null };
  });

  useEffect(() => {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(authState));
  }, [authState]);

  const login = useCallback((user: 'mom' | 'dad') => {
    setAuthState({ isAuthenticated: true, user });
  }, []);

  const logout = useCallback(() => {
    setAuthState({ isAuthenticated: false, user: null });
    sessionStorage.removeItem(AUTH_KEY);
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
}
