import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import {
  getCurrentLocalAccount,
  findLocalAccount,
  LocalAuthAccount,
  setCurrentLocalAccount,
  clearCurrentLocalAccount,
} from '@/lib/localAuth';

interface Profile {
  id: string;
  phone: string;
  display_name: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  loginLocal: (profile: Profile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [localAuth, setLocalAuth] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, phone, display_name')
      .eq('user_id', userId)
      .maybeSingle();
    
    setProfile(data);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        if (session?.user) {
          setUser(session.user);
          setLocalAuth(false);
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setUser(null);
          const currentPhone = getCurrentLocalAccount();
          if (currentPhone) {
            const account = findLocalAccount(currentPhone);
            if (account) {
              setLocalAuth(true);
              setProfile({
                id: account.phone,
                phone: account.phone,
                display_name: account.displayName,
              });
            } else {
              setLocalAuth(false);
              setProfile(null);
            }
          } else {
            setLocalAuth(false);
            setProfile(null);
          }
        }
        setIsLoading(false);
      }
    );

    // THEN check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setLocalAuth(false);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        const currentPhone = getCurrentLocalAccount();
        if (currentPhone) {
          const account = findLocalAccount(currentPhone);
          if (account) {
            setLocalAuth(true);
            setProfile({
              id: account.phone,
              phone: account.phone,
              display_name: account.displayName,
            });
          }
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    clearCurrentLocalAccount();
    setUser(null);
    setProfile(null);
    setLocalAuth(false);
  }, []);

  const loginLocal = useCallback((profile: Profile) => {
    setUser(null);
    setLocalAuth(true);
    setProfile(profile);
    setCurrentLocalAccount(profile.phone);
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!user || localAuth, 
      user, 
      profile,
      isLoading,
      logout,
      loginLocal,
    }}>
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
