import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AppIdentity {
  appName: string;
  logoUrl: string;
  supportEmail: string;
  primaryColor: string;
}

const DEFAULT_IDENTITY: AppIdentity = {
  appName: 'RAP Nova Escola',
  logoUrl: '',
  supportEmail: '',
  primaryColor: '#3399ce',
};

const AppIdentityContext = createContext<AppIdentity>(DEFAULT_IDENTITY);

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function AppIdentityProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['app-identity'],
    queryFn: () => fetch(`${API_URL}/api/public/identity`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const identity: AppIdentity = data
    ? {
        appName:      data.app_name          || DEFAULT_IDENTITY.appName,
        logoUrl:      data.app_logo_url      || '',
        supportEmail: data.app_support_email || '',
        primaryColor: data.app_primary_color || DEFAULT_IDENTITY.primaryColor,
      }
    : DEFAULT_IDENTITY;

  useEffect(() => {
    if (identity.primaryColor) {
      document.documentElement.style.setProperty('--color-brand', identity.primaryColor);
    }
    if (identity.appName) {
      document.title = identity.appName;
    }
  }, [identity.primaryColor, identity.appName]);

  return (
    <AppIdentityContext.Provider value={identity}>
      {children}
    </AppIdentityContext.Provider>
  );
}

export function useAppIdentity(): AppIdentity {
  return useContext(AppIdentityContext);
}
