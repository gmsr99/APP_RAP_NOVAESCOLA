/**
 * PushAutoPrompt
 *
 * Quando a app corre em modo standalone (instalada no ecrã principal),
 * pede uma vez ao utilizador para ativar notificações push.
 * Usa localStorage para não voltar a perguntar depois.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'push-prompt-dismissed';

export function PushAutoPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, isLoading, subscribe } = usePushNotifications();

  useEffect(() => {
    // Apenas mostrar se:
    // - utilizador autenticado
    // - push suportado (inclui verificação de standalone no iOS)
    // - ainda não subscrito
    // - permissão ainda não dada/negada
    // - ainda não foi dispensado antes
    if (
      !user ||
      !isSupported ||
      isSubscribed ||
      isLoading ||
      Notification.permission !== 'default' ||
      localStorage.getItem(STORAGE_KEY)
    ) return;

    // Pequeno delay para a app carregar primeiro
    const timer = setTimeout(() => {
      toast('Ativar notificações?', {
        description: 'Recebe alertas de sessões, mensagens e atualizações.',
        duration: 12000,
        action: {
          label: 'Ativar',
          onClick: () => {
            subscribe();
          },
        },
        onDismiss: () => {
          localStorage.setItem(STORAGE_KEY, '1');
        },
        cancel: {
          label: 'Agora não',
          onClick: () => {
            localStorage.setItem(STORAGE_KEY, '1');
          },
        },
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, isLoading]);

  return null;
}
