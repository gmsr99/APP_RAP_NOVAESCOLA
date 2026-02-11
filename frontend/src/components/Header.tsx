import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { NotificationCenter } from '@/components/NotificationCenter';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function Header() {
  const { user, isAuthenticated } = useProfile();
  const { signOut } = useAuth();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
      <ProfileSwitcher />


      <div className="flex items-center gap-4 ml-auto">
        <NotificationCenter />

        <div className="flex items-center gap-3">
          {isAuthenticated && (
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
            {user.name.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}
