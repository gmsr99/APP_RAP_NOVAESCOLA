/**
 * usePushNotifications
 *
 * Gere a subscrição de Web Push Notifications.
 * - Deteta suporte do browser (iOS 16.4+ requer standalone)
 * - Pede permissão ao utilizador via gesto
 * - Subscreve/cancela subscrição no backend
 * - Usa @/lib/api (axios) consistentemente com o resto da app
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

/** Converte uma chave VAPID public key (base64url) para Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/** Aguarda o service worker ficar ativo, com timeout de 10s */
async function waitForSW(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Service worker não iniciou a tempo')), 10000)
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // iOS requer standalone; Android/Desktop não
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      (!ios || standalone);

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      _checkSubscription().then(setIsSubscribed);
    }
  }, []);

  async function _checkSubscription(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch {
      return false;
    }
  }

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsLoading(true);
    try {
      // Garantir que o SW está registado e ativo
      await navigator.serviceWorker.register('/sw.js');
      const reg = await waitForSW();

      // Pedir permissão (deve ser chamado via gesto do utilizador)
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'denied') {
        toast.error('Notificações bloqueadas', {
          description: 'Permite as notificações nas definições do browser.',
        });
        return false;
      }
      if (perm !== 'granted') return false;

      // Obter chave pública VAPID do backend
      const vapidRes = await api.get<{ public_key: string }>('/api/push/vapid-key');
      const public_key = vapidRes.data.public_key;

      if (!public_key) throw new Error('VAPID key não recebida do servidor');

      // Subscrever no PushManager
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      const sub = subscription.toJSON();
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        throw new Error('Dados de subscrição inválidos');
      }

      // Enviar subscrição ao backend
      await api.post('/api/push/subscribe', {
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      });

      setIsSubscribed(true);
      toast.success('Notificações ativadas!');
      return true;
    } catch (err: any) {
      console.error('Erro ao subscrever push:', err);
      toast.error('Erro ao ativar notificações', {
        description: err?.message || 'Tenta novamente mais tarde.',
      });
      // Re-verificar estado real caso tenha ficado inconsistente
      const realState = await _checkSubscription();
      setIsSubscribed(realState);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      toast.success('Notificações desativadas');
    } catch (err: any) {
      console.error('Erro ao cancelar push:', err);
      toast.error('Erro ao desativar notificações');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isStandalone,
    isIOS,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
