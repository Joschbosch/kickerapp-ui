import { NEVER, Observable, Subject } from 'rxjs';

import { LiveMessage, LiveUpdates } from '../core/events/live-updates';

/** Für Seiten-Tests, die keinen Stream brauchen: es kommt nie etwas, die Seite bleibt beim Ersatz-Abfragen. */
export function noLiveUpdates() {
  return { provide: LiveUpdates, useValue: { watch: (): Observable<LiveMessage> => NEVER } };
}

/** Für Seiten-Tests, die Events auslösen wollen: `messages.next(...)` schickt etwas an die Seite. */
export function controlledLiveUpdates() {
  const messages = new Subject<LiveMessage>();
  const watched: string[] = [];
  return {
    messages,
    watched,
    provider: {
      provide: LiveUpdates,
      useValue: {
        watch: (id: string): Observable<LiveMessage> => {
          watched.push(id);
          return messages.asObservable();
        },
      },
    },
  };
}
