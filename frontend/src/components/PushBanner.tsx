import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { IOSInstallDialog } from '@/components/PushAutoPrompt';

const SESSION_KEY = 'push-banner-dismissed';

export function PushBanner() {
  const {
    isSupported,
    isIOS,
    isStandalone,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
  } = usePushNotifications();

  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === '1'
  );
  const [iosOpen, setIosOpen] = useState(false);

  // Hide conditions
  if (dismissed) return null;
  if (isSubscribed) return null;
  if (isSupported && permission === 'denied') return null;
  if (!isIOS && !isSupported) return null;

  const isIOSBanner = isIOS && !isStandalone;

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
      <div
        className={cn(
          'px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 border-b text-sm',
          isIOSBanner
            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
        )}
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 shrink-0" />
          <span>
            {isIOSBanner
              ? 'Instala a app para receber notificações no iPhone. '
              : 'Ativa as notificações para não perderes nenhuma atualização. '}
            {isIOSBanner ? (
              <button
                onClick={() => setIosOpen(true)}
                className="font-medium underline hover:no-underline"
              >
                Como instalar
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={isLoading}
                className="font-medium underline hover:no-underline disabled:opacity-60"
              >
                {isLoading ? 'A ativar...' : 'Ativar agora'}
              </button>
            )}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className={cn(
            'shrink-0',
            isIOSBanner
              ? 'text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200'
              : 'text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200'
          )}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isIOSBanner && (
        <IOSInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
      )}
    </>
  );
}
