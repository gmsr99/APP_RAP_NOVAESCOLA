import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User, UserPermissions } from '@/types';

interface AuthContextType {
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  /** User no formato da app (id, name, email, role) */
  user: User | null;
  /** Permissões resolvidas do utilizador (is_root, allowed_pages, etc.) */
  permissions: UserPermissions | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string, role?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supabaseUserToAppUser(su: SupabaseUser): User {
  const meta = su.user_metadata ?? {};
  return {
    id: su.id,
    name: meta.full_name ?? meta.name ?? su.email?.split('@')[0] ?? 'Utilizador',
    email: su.email ?? '',
    role: meta.role ?? 'coordenador',
    avatar: meta.avatar_url,
  };
}

async function fetchPermissions(accessToken: string): Promise<UserPermissions | null> {
  const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
  try {
    const res = await fetch(`${API_URL}/api/me/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const supabaseUser = session?.user ?? null;
  const user: User | null = supabaseUser ? supabaseUserToAppUser(supabaseUser) : null;

  const refreshPermissions = useCallback(async () => {
    if (!session?.access_token) {
      setPermissions(null);
      return;
    }
    const perms = await fetchPermissions(session.access_token);
    setPermissions(perms);
  }, [session?.access_token]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.access_token) {
        const perms = await fetchPermissions(s.access_token);
        setPermissions(perms);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.access_token) {
        const perms = await fetchPermissions(s.access_token);
        setPermissions(perms);
      } else {
        setPermissions(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-fetch permissions on window focus (picks up changes made by admin)
  useEffect(() => {
    const handler = () => { refreshPermissions(); };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [refreshPermissions]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signUp = async (email: string, password: string, fullName?: string, role = 'mentor') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    return { error: error ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextType = {
    session,
    supabaseUser,
    user,
    permissions,
    loading,
    signIn,
    signUp,
    signOut,
    refreshPermissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
