import { Signal, effect, inject, signal, untracked } from '@angular/core';

import { LiveStatus, LiveUpdates } from './live-updates';

/** Mehrere Events kurz hintereinander (z. B. Ergebnis und Rangliste) führen nur zu einem Neuladen. */
export const LIVE_DEBOUNCE_MS = 300;

export interface LiveReloadOptions {
  /** Das Turnier, dessen Änderungen interessieren. Wechselt es, wird neu verbunden. */
  id: () => string;
  /** Lädt den Stand neu. */
  reload: () => void;
  /** Läuft gerade ein Laden? Dann wird beim Ersatz-Abfragen nichts doppelt angefragt. */
  busy?: () => boolean;
  /** So oft wird nachgefragt, solange der Stream nicht steht. */
  fallbackMs: number;
}

/**
 * Lädt eine Seite bei Live-Updates neu und fragt ersatzweise regelmäßig nach, solange keine Verbindung steht. Muss im
 * Konstruktor (Injektionskontext) aufgerufen werden. Gibt den Verbindungsstatus für die Anzeige zurück.
 */
export function liveReload(options: LiveReloadOptions): Signal<LiveStatus> {
  const live = inject(LiveUpdates);
  const status = signal<LiveStatus>('connecting');

  effect((onCleanup) => {
    const id = options.id();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const subscription = untracked(() =>
      live.watch(id).subscribe((message) => {
        if (message.kind === 'status') {
          status.set(message.status);
        } else {
          clearTimeout(debounce);
          debounce = setTimeout(() => options.reload(), LIVE_DEBOUNCE_MS);
        }
      }),
    );
    onCleanup(() => {
      subscription.unsubscribe();
      clearTimeout(debounce);
      status.set('connecting');
    });
  });

  effect((onCleanup) => {
    if (status() !== 'live') {
      const timer = setInterval(() => {
        if (!options.busy?.()) {
          options.reload();
        }
      }, options.fallbackMs);
      onCleanup(() => clearInterval(timer));
    }
  });

  return status.asReadonly();
}
