import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { UserProfile, User } from '@/types';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const ALL_PAGE_SLUGS = new Set([
  'dashboard', 'horarios', 'producao', 'tarefas', 'estudio', 'chat',
  'equipa', 'wiki', 'contactos', 'atalhos', 'registos', 'equipamento',
  'estatisticas', 'formacao', 'admin', 'financeiro',
]);

interface ProfileContextType {
  profile: UserProfile;
  user: User;
  setProfile: (profile: UserProfile) => void;
  /** true quando o user vem da sessão Supabase (autenticado) */
  isAuthenticated: boolean;
  /** Conjunto de page slugs acessíveis pelo utilizador */
  allowedPages: Set<string>;
  /** true se o utilizador é root (level_order >= 5) */
  isRoot: boolean;
  /** true se o utilizador tem acesso de direção (is_root ou is_direcao) */
  isDirecao: boolean;
  /** true se o utilizador tem acesso de coordenação ou superior */
  isCoordenacao: boolean;
  /** Dicionário de action keys → bool da patente do utilizador */
  allowedActions: Record<string, boolean>;
  /** Retorna true se a patente do utilizador permite a action key (root sempre true) */
  canDo: (actionKey: string) => boolean;
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

  const isRoot = permissions ? permissions.is_root : false;

  const isDirecao = permissions
    ? (permissions.is_root || permissions.is_direcao)
    : ['direcao', 'it_support'].includes(profile);

  const isCoordenacao = permissions
    ? (permissions.is_root || permissions.is_direcao || permissions.is_coordenacao)
    : ['coordenador', 'direcao', 'it_support'].includes(profile);

  const allowedActions: Record<string, boolean> = useMemo(
    () => permissions?.allowed_actions ?? {},
    [permissions]
  );

  const canDo = useMemo(
    () => (actionKey: string): boolean => {
      if (isRoot) return true;
      return allowedActions[actionKey] === true;
    },
    [isRoot, allowedActions]
  );

  // Se estiver autenticado, usar o user da sessão; senão, fallback para mock por perfil
  const user: User = authUser
    ? { ...authUser, role: dbRole ?? authUser.role }
    : currentUser[profile];
  const isAuthenticated = !!authUser;

  const setProfile = (p: UserProfile) => setManualProfile(p);

  return (
    <ProfileContext.Provider value={{ profile, user, setProfile, isAuthenticated, allowedPages, isRoot, isDirecao, isCoordenacao, allowedActions, canDo }}>
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
