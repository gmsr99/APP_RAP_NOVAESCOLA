import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';

/**
 * Quando o Supabase está configurado, exige sessão e redireciona para /login.
 * Se requiredPage for fornecido, redireciona para / quando o utilizador não tem acesso.
 */
export function ProtectedRoute({
  children,
  requiredPage,
}: {
  children: React.ReactNode;
  requiredPage?: string;
}) {
  const { user, loading } = useAuth();
  const { allowedPages } = useProfile();
  const location = useLocation();
  const supabaseConfigured = !!(
    import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
  );

  if (!supabaseConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">A carregar...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPage && !allowedPages.has(requiredPage)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
