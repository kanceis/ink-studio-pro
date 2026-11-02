/**
 * Serviço de Notificações do Sistema para iPad, Telemóvel e Computador
 * Utiliza a Web Notification API padrão suportada pelo iPadOS 16.4+, iOS PWA e Android
 */

export type SystemNotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export const isSystemNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getSystemNotificationPermission = (): SystemNotificationPermissionStatus => {
  if (!isSystemNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission as SystemNotificationPermissionStatus;
};

export const requestSystemNotificationPermission = async (): Promise<SystemNotificationPermissionStatus> => {
  if (!isSystemNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission as SystemNotificationPermissionStatus;
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificações do sistema:', err);
    return Notification.permission as SystemNotificationPermissionStatus;
  }
};

/**
 * Dispara uma notificação nativa no sistema operativo do iPad/iPhone/Android
 */
export const dispatchSystemNotification = async (
  title: string,
  options: {
    body: string;
    tag?: string;
    data?: unknown;
    requireInteraction?: boolean;
    silent?: boolean;
  }
): Promise<boolean> => {
  if (!isSystemNotificationSupported()) {
    return false;
  }

  // Tenta pedir permissão se ainda não foi decidida
  if (Notification.permission === 'default') {
    const res = await requestSystemNotificationPermission();
    if (res !== 'granted') return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    // Vibração háptica no telemóvel/iPad se suportado
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch {
        // Ignora caso dispositivo bloqueie
      }
    }

    // Se houver service worker registado, prefere o showNotification do Service Worker
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(title, {
            body: options.body,
            icon: '/favicon.ico',
            tag: options.tag || `inkstudio-${Date.now()}`,
            data: options.data,
            requireInteraction: options.requireInteraction ?? false,
            silent: options.silent ?? false,
          });
          return true;
        }
      } catch {
        // Fallback para new Notification padrão
      }
    }

    // Instanciação direta da notificação Web
    const notification = new Notification(title, {
      body: options.body,
      icon: '/favicon.ico',
      tag: options.tag || `inkstudio-${Date.now()}`,
      data: options.data,
      requireInteraction: options.requireInteraction ?? false,
      silent: options.silent ?? false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (err) {
    console.error('Falha ao disparar notificação do sistema:', err);
    return false;
  }
};
