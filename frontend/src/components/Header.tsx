import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { NotificationSidebar } from '@/components/notifications/NotificationSidebar';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Bell, UserCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function Header() {
  const { user, isAuthenticated } = useProfile();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await api.get('/api/notifications');
      return res.data.filter((n: any) => !n.read).length;
    },
    refetchInterval: 30000,
  });

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card">
      <ProfileSwitcher />

      <div className="flex items-center gap-4 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => setIsNotificationOpen(true)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>

        <NotificationSidebar
          open={isNotificationOpen}
          onOpenChange={setIsNotificationOpen}
        />

        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize mt-1">{user.role}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  user.name.charAt(0)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/myspace')} className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                A minha Conta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {isAuthenticated && (
                <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
