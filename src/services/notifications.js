import { LocalNotifications } from '@capacitor/local-notifications';

class NotificationService {
  constructor() {
    this.permissionGranted = false;
  }

  async requestPermissions() {
    try {
      const status = await LocalNotifications.requestPermissions();
      this.permissionGranted = status.display === 'granted';
    } catch {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const res = await Notification.requestPermission();
          this.permissionGranted = res === 'granted';
        } catch {
          // Ignora
        }
      } else if ('Notification' in window) {
        this.permissionGranted = Notification.permission === 'granted';
      }
    }
  }

  async notifyPhaseTransition(title, body) {
    if (document.visibilityState === 'visible') return;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() % 2147483647),
            title,
            body,
            schedule: { at: new Date(Date.now() + 100) }
          }
        ]
      });
    } catch {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon: '/icons/icon.svg',
            tag: 'cronociclo-phase'
          });
        } catch {
          // Ignora se bloqueado
        }
      }
    }
  }
}

export const notifications = new NotificationService();
