import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const AUTH_KEY = 'jeanne_jewelry_auth';

interface AuthState {
  isAuthenticated: boolean;
  user: 'mom' | 'dad' | null;
}

interface AuthContextType extends AuthState {
  login: (user: 'mom' | 'dad') => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
