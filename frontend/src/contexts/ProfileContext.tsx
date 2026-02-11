import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { UserProfile, User } from '@/types';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface ProfileContextType {
  profile: UserProfile;
  user: User;
  setProfile: (profile: UserProfile) => void;
  /** true quando o user vem da sessão Supabase (autenticado) */
  isAuthenticated: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user: authUser } = useAuth();
  const [manualProfile, setManualProfile] = useState<UserProfile | null>(null);
  const [dbRole, setDbRole] = useState<UserProfile | null>(null);

  // Derive profile: Prefer manual override, then DB role (authoritative), then auth user role (JWT cache), then default
  const profile: UserProfile = manualProfile ?? dbRole ?? authUser?.role ?? 'coordenador';

  // Reset manual override and dbRole when user changes
  useEffect(() => {
    setManualProfile(null);
    setDbRole(null);

    // Fetch authoritative role from DB
    if (authUser?.id) {
      console.log('ProfileContext: Fetching role for', authUser.id);
      supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single()
        .then(({ data, error }) => {
          console.log('ProfileContext: Fetch result', { data, error });
          if (error) {
            console.error('ProfileContext: Error fetching role', error);
          }
          if (data?.role) {
            console.log('ProfileContext: Setting dbRole to', data.role);
            setDbRole(data.role as UserProfile);
          }
        });
    }
  }, [authUser?.id]);

  // Se estiver autenticado, usar o user da sessão; senão, fallback para mock por perfil
  // CRITICAL: Override role with DB role (authoritative source) when available
  const user: User = authUser
    ? { ...authUser, role: dbRole ?? authUser.role }
    : currentUser[profile];
  const isAuthenticated = !!authUser;

  // Wrapper for setProfile to update manual state
  const setProfile = (p: UserProfile) => setManualProfile(p);

  return (
    <ProfileContext.Provider value={{ profile, user, setProfile, isAuthenticated }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
