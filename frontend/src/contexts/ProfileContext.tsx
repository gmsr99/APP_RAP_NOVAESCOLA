import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { UserProfile, User } from '@/types';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const ALL_PAGE_SLUGS = new Set([
  'dashboard', 'horarios', 'producao', 'tarefas', 'estudio', 'chat',
  'equipa', 'wiki', 'contactos', 'atalhos', 'registos', 'equipamento',
  'estatisticas', 'formacao', 'admin',
]);

interface ProfileContextType {
  profile: UserProfile;
  user: User;
  setProfile: (profile: UserProfile) => void;
  /** true quando o user vem da sessão Supabase (autenticado) */
  isAuthenticated: boolean;
  /** Conjunto de page slugs acessíveis pelo utilizador */
  allowedPages: Set<string>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user: authUser, permissions } = useAuth();
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
      supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single()
        .then(({ data }) => {
          if (data?.role) setDbRole(data.role as UserProfile);
        });
    }
  }, [authUser?.id]);

  // Derive allowed pages from the fetched permissions (authoritative).
  // Falls back to role-based defaults while permissions are still loading.
  const allowedPages = useMemo((): Set<string> => {
    if (permissions) {
      if (permissions.is_root) return ALL_PAGE_SLUGS;
      return new Set(permissions.allowed_pages);
    }
    // Fallback: derive from role while permissions load
    const r = profile;
    const base = new Set(['dashboard','horarios','producao','tarefas','estudio','chat','equipa','wiki','contactos','atalhos','formacao']);
    if (r !== 'videomaker') base.add('registos');
    if (['coordenador','direcao','it_support'].includes(r)) { base.add('equipamento'); base.add('estatisticas'); }
    if (['direcao','it_support'].includes(r)) base.add('admin');
    return base;
  }, [permissions, profile]);

  // Se estiver autenticado, usar o user da sessão; senão, fallback para mock por perfil
  const user: User = authUser
    ? { ...authUser, role: dbRole ?? authUser.role }
    : currentUser[profile];
  const isAuthenticated = !!authUser;

  const setProfile = (p: UserProfile) => setManualProfile(p);

  return (
    <ProfileContext.Provider value={{ profile, user, setProfile, isAuthenticated, allowedPages }}>
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
