import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { EventTicket } from '../../api/models';
import { AppConfigService } from '../app-config';

/** `live`: der Stream steht. `connecting`: es wird (neu) verbunden. `offline`: Verbindung weg, es wird neu versucht. */
export type LiveStatus = 'connecting' | 'live' | 'offline';

/** Was ein Abonnent mitbekommt: eine Änderung des Verbindungsstatus oder den Hinweis, dass sich etwas geändert hat. */
export type LiveMessage =
  | { kind: 'status'; status: LiveStatus }
  | { kind: 'change'; resync: boolean };

/** Erzeugt den `EventSource`. Tests ersetzen das, weil jsdom keinen kennt. */
export type EventSourceFactory = (url: string) => EventSource;

export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url),
});

/** Die Events, nach denen der Stand neu zu laden ist. Sie tragen keine Daten (siehe Übergabe, Abschnitt 6). */
const CHANGE_EVENTS = [
  'TOURNAMENT_CHANGED',
  'PARTICIPANTS_CHANGED',
  'ROUND_STARTED',
  'MATCHES_CHANGED',
  'RANKING_CHANGED',
];
const RESYNC_EVENT = 'RESYNC';
/** `EventSource.CLOSED`, als Zahl, weil die Konstante nicht überall vorhanden ist. */
const CLOSED = 2;

export const RETRY_FIRST_MS = 3_000;
export const RETRY_MAX_MS = 30_000;

/**
 * Live-Updates eines Turniers per Server-Sent Events. Der Browser-`EventSource` kann keinen Authorization-Header
 * senden, deshalb wird mit dem Token ein kurzes Ticket geholt und an die Adresse gehängt. Reißt die Verbindung ab,
 * verbindet sich der Dienst mit einem neuen Ticket und der letzten Event-Kennung (`lastEventId`) neu, das Backend
 * liefert dann Verpasstes nach oder meldet `RESYNC`. Nach einer Lücke ohne bekannte Kennung wird zur Sicherheit
 * ebenfalls ein Neuladen gemeldet.
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly createSource = inject(EVENT_SOURCE_FACTORY);

  /**
   * Öffnet den Stream für ein Turnier, solange abonniert ist. Mit dem Abbestellen wird die Verbindung geschlossen.
   * Den ersten Stand lädt der Aufrufer selbst, hier kommt nur, was sich danach ändert.
   */
  watch(tournamentId: string): Observable<LiveMessage> {
    return new Observable<LiveMessage>((subscriber) => {
      let lastEventId: string | null = null;
      let source: EventSource | null = null;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      let retryMs = RETRY_FIRST_MS;
      let wasConnected = false;
      let closed = false;

      const status = (value: LiveStatus) => subscriber.next({ kind: 'status', status: value });

      const retryLater = () => {
        status('offline');
        retryTimer = setTimeout(() => void connect(), retryMs);
        retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
      };

      const connect = async () => {
        status('connecting');
        let ticket: EventTicket;
        try {
          ticket = await firstValueFrom(
            this.http.post<EventTicket>(this.config.url(`/api/tournaments/${tournamentId}/events/ticket`), {}),
          );
        } catch {
          if (!closed) {
            retryLater();
          }
          return;
        }
        if (closed) {
          return;
        }

        const resume = lastEventId ? `&lastEventId=${encodeURIComponent(lastEventId)}` : '';
        const current = this.createSource(this.config.url(ticket.streamUrl) + resume);
        source = current;

        current.addEventListener('connected', () => {
          retryMs = RETRY_FIRST_MS;
          status('live');
          if (wasConnected) {
            // Zwischen zwei Verbindungen kann etwas passiert sein, das sich nicht nachliefern lässt
            subscriber.next({ kind: 'change', resync: true });
          }
          wasConnected = true;
        });
        for (const type of CHANGE_EVENTS) {
          current.addEventListener(type, (event) => {
            remember(event);
            subscriber.next({ kind: 'change', resync: false });
          });
        }
        current.addEventListener(RESYNC_EVENT, (event) => {
          remember(event);
          subscriber.next({ kind: 'change', resync: true });
        });
        current.onerror = () => {
          status('offline');
          if (current.readyState === CLOSED) {
            // Z. B. Ticket abgelaufen: der Browser gibt auf, also mit neuem Ticket selbst neu verbinden
            current.close();
            retryLater();
          }
          // Sonst verbindet sich der Browser von allein neu und schickt die Kennung als Last-Event-ID
        };
      };

      const remember = (event: Event) => {
        const id = (event as MessageEvent).lastEventId;
        if (id) {
          lastEventId = id;
        }
      };

      void connect();

      return () => {
        closed = true;
        clearTimeout(retryTimer);
        source?.close();
      };
    });
  }
}
