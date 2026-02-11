import { useState } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { getNotificationsByProfile, getUnreadNotificationsCount } from '@/data/mockData';
import { Bell, X, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

const typeConfig = {
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10' },
  action: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' },
  urgent: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

export function NotificationCenter() {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  
  const notifications = getNotificationsByProfile(profile);
  const unreadCount = getUnreadNotificationsCount(profile);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
              {unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-card border-border">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="font-display text-xl">Notificações</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="space-y-3 pr-4">
            {notifications.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Sem notificações de momento.
              </p>
            ) : (
              notifications.map((notification) => {
                const config = typeConfig[notification.type];
                const Icon = config.icon;
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'rounded-lg p-4 transition-colors',
                      notification.read ? 'bg-secondary/30' : config.bg
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('mt-0.5', config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn(
                            'font-medium text-sm',
                            !notification.read && 'text-foreground'
                          )}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <Badge variant="secondary" className="text-xs">Nova</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(notification.createdAt, { 
                            addSuffix: true, 
                            locale: pt 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
