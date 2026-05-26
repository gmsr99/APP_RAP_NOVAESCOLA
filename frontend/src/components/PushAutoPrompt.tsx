import { useState, useEffect } from 'react';
import { Bell, Share, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'push-prompt-dismissed-until';
const LEGACY_KEY = 'push-prompt-dismissed';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function getDismissedUntil(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

function snooze() {
  localStorage.setItem(STORAGE_KEY, new Date(Date.now() + SNOOZE_MS).toISOString());
}

function blockPermanently() {
  localStorage.setItem(STORAGE_KEY, 'never');
}

function migrateLegacyKey() {
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy === '1') {
    snooze();
    localStorage.removeItem(LEGACY_KEY);
  }
}

// ─── IOSInstallDialog ────────────────────────────────────────────────────────

interface IOSInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallDialog({ open, onOpenChange }: IOSInstallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Instalar app no iPhone</DialogTitle>
          <DialogDescription>
            Segue estes passos para receberes notificações no iOS.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 py-1 text-sm">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              1
            </span>
            <span>
              Toca no ícone de partilha{' '}
              <Share className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
              na barra inferior do Safari.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              2
            </span>
            <span>
              Desloca para baixo e escolhe{' '}
              <strong>"Adicionar ao Ecrã Principal"</strong>{' '}
              <Plus className="inline h-4 w-4 align-text-bottom text-primary" />.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              3
            </span>
            <span>
              Toca em <strong>"Adicionar"</strong> no canto superior direito.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
              4
            </span>
            <span>
              Abre a app pelo ícone no ecrã principal — as notificações ficam disponíveis.
            </span>
          </li>
        </ol>
        <DialogFooter>
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            OK, percebo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── PushAutoPrompt ──────────────────────────────────────────────────────────

export function PushAutoPrompt() {
  const { user } = useAuth();
  const {
    isSupported,
    isIOS,
    isStandalone,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
  } = usePushNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    migrateLegacyKey();

    if (!user || isLoading || isSubscribed) return;

    const dismissedUntil = getDismissedUntil();
    if (dismissedUntil === 'never') return;
    if (dismissedUntil && Date.now() < new Date(dismissedUntil).getTime()) return;

    const shouldShow =
      (isIOS && !isStandalone) ||
      (isSupported && permission !== 'denied');

    if (!shouldShow) {
      if (isSupported && permission === 'denied') blockPermanently();
      return;
    }

    const timer = setTimeout(() => setOpen(true), 3000);
    return () => clearTimeout(timer);
  }, [user, isSupported, isIOS, isStandalone, isSubscribed, isLoading, permission]);

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setOpen(false);
    } else {
      if (Notification.permission === 'denied') {
        blockPermanently();
      } else {
        snooze();
      }
      setOpen(false);
    }
  };

  const handleLater = () => {
    snooze();
    setOpen(false);
  };

  const isIOSGuide = isIOS && !isStandalone;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[400px]"
      >
        <DialogHeader>
          {!isIOSGuide && (
            <div className="flex justify-center mb-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bell className="h-7 w-7 text-primary" />
              </div>
            </div>
          )}
          <DialogTitle className="text-center">
            {isIOSGuide ? 'Notificações no iPhone' : 'Ativar notificações'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isIOSGuide
              ? 'Para receberes notificações no iPhone, instala a app no ecrã principal.'
              : 'Recebe alertas de sessões, mensagens e atualizações em tempo real.'}
          </DialogDescription>
        </DialogHeader>

        {isIOSGuide && (
          <ol className="space-y-4 py-1 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                1
              </span>
              <span>
                Toca no ícone de partilha{' '}
                <Share className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                na barra inferior do Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                2
              </span>
              <span>
                Desloca para baixo e escolhe{' '}
                <strong>"Adicionar ao Ecrã Principal"</strong>{' '}
                <Plus className="inline h-4 w-4 align-text-bottom text-primary" />.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                3
              </span>
              <span>
                Toca em <strong>"Adicionar"</strong> no canto superior direito.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                4
              </span>
              <span>
                Abre a app pelo ícone no ecrã principal — as notificações ficam disponíveis.
              </span>
            </li>
          </ol>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isIOSGuide ? (
            <Button className="w-full" onClick={handleLater}>
              OK, entendi
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleLater} className="sm:flex-1">
                Mais tarde
              </Button>
              <Button onClick={handleSubscribe} disabled={isLoading} className="sm:flex-1">
                {isLoading ? 'A ativar...' : 'Ativar notificações'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
