import { InjectionToken } from '@angular/core';

import { Pairing, pairingText } from '../../shared/pairing';

/** Ein Spieler ist dran: sein Match wurde einem Tisch zugewiesen. */
export interface TurnCall extends Pairing {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  round: number;
  table: number;
}

export type NotificationState = NotificationPermission | 'unsupported';

/** Was auf dem Gerät passiert, wenn jemand dran ist. Tests ersetzen das. */
export interface AlertEffects {
  /** Gibt Ton, Vibration und, wenn die Seite nicht sichtbar ist, eine Systembenachrichtigung aus. */
  announce(call: TurnCall, options: { sound: boolean }): void;
  /** Ob der Browser Systembenachrichtigungen erlaubt (`default` = noch nicht gefragt). */
  permission(): NotificationState;
  /** Fragt den Nutzer. Muss aus einem Klick heraus aufgerufen werden. */
  requestPermission(): Promise<NotificationState>;
}

export const ALERT_EFFECTS = new InjectionToken<AlertEffects>('ALERT_EFFECTS', {
  providedIn: 'root',
  factory: () => new BrowserAlertEffects(),
});

export function callTitle(call: TurnCall): string {
  return `Du bist dran – Tisch ${call.table}`;
}

/** „Mit Anna gegen Ben und Clara“. */
export function callLine(call: TurnCall): string {
  return capitalize(pairingText(call));
}

export function callBody(call: TurnCall): string {
  return `${callLine(call)} · ${call.tournamentName}, Runde ${call.round}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Die Wirkungen im Browser. Alles ist beste Mühe: Vibration, Ton und Benachrichtigungen gibt es nicht überall und nicht
 * immer (Ton erst nach dem ersten Tippen auf die Seite, Vibration nicht auf dem Desktop). Echtes Push bei geschlossener App
 * gibt es nicht, dafür fehlt dem Backend die Gegenseite.
 */
export class BrowserAlertEffects implements AlertEffects {
  private audio: AudioContext | null = null;

  constructor() {
    // Browser starten Ton erst nach einer Eingabe des Nutzers: beim ersten Tippen die Tonausgabe freischalten
    const unlock = () => {
      try {
        this.audio ??= new AudioContext();
        void this.audio.resume();
      } catch {
        // kein Ton verfügbar
      }
    };
    addEventListener('pointerdown', unlock, { once: true });
    addEventListener('keydown', unlock, { once: true });
  }

  announce(call: TurnCall, options: { sound: boolean }): void {
    try {
      navigator.vibrate?.([250, 120, 250, 120, 500]);
    } catch {
      // nicht überall verfügbar
    }
    if (options.sound) {
      this.beep();
    }
    if (document.visibilityState === 'hidden' && this.permission() === 'granted') {
      void this.showNotification(call);
    }
  }

  permission(): NotificationState {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  async requestPermission(): Promise<NotificationState> {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  private beep(): void {
    const audio = this.audio;
    if (audio === null || audio.state !== 'running') {
      return;
    }
    // Drei kurze aufsteigende Töne
    [660, 880, 1100].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.22;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    });
  }

  private async showNotification(call: TurnCall): Promise<void> {
    const options = {
      body: callBody(call),
      tag: `call-${call.matchId}`,
      icon: 'icons/icon-192x192.png',
      requireInteraction: true,
      // Der Service Worker der App öffnet beim Antippen die Turnierseite
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: `/turniere/${call.tournamentId}` } } },
    };
    try {
      // Auf Android geht `new Notification` nicht, dort nur über den Service Worker (im Produktions-Build vorhanden)
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.showNotification(callTitle(call), options);
      } else {
        new Notification(callTitle(call), options);
      }
    } catch {
      // Benachrichtigung nicht möglich
    }
  }
}
