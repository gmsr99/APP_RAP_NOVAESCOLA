import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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
  const [identity, setIdentity] = useState<AppIdentity>(DEFAULT_IDENTITY);

  useEffect(() => {
    fetch(`${API_URL}/api/public/identity`)
      .then((r) => r.json())
      .then((data) => {
        const resolved: AppIdentity = {
          appName:      data.app_name      || DEFAULT_IDENTITY.appName,
          logoUrl:      data.app_logo_url  || '',
          supportEmail: data.app_support_email || '',
          primaryColor: data.app_primary_color || DEFAULT_IDENTITY.primaryColor,
        };
        setIdentity(resolved);
        // Apply primary color as CSS variable
        if (resolved.primaryColor) {
          document.documentElement.style.setProperty('--color-brand', resolved.primaryColor);
        }
        // Update browser tab title
        if (resolved.appName) {
          document.title = resolved.appName;
        }
      })
      .catch(() => {
        // Silently fall back to defaults
      });
  }, []);

  return (
    <AppIdentityContext.Provider value={identity}>
      {children}
    </AppIdentityContext.Provider>
  );
}

export function useAppIdentity(): AppIdentity {
  return useContext(AppIdentityContext);
}
