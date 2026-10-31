import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { Match } from '../../api/models';
import { pairing } from '../../shared/pairing';
import { AuthService } from '../auth/auth.service';
import { LiveUpdates } from '../events/live-updates';
import { ALERT_EFFECTS, NotificationState, TurnCall } from './alert-effects';

/** So oft wird nachgesehen, ob ein Turnier läuft, in dem der Spieler mitspielt. */
export const TOURNAMENT_REFRESH_MS = 60_000;
/** Ersatz-Abfrage der eigenen Spiele, solange der Live-Stream nicht steht. */
export const FALLBACK_POLL_MS = 15_000;
/** Mehrere Events kurz hintereinander werden zu einer Abfrage. */
export const ALERT_DEBOUNCE_MS = 300;

const SOUND_KEY = 'kickertool.alert.sound';
const SEEN_KEY = 'kickertool.alert.seen';
const DISMISSED_KEY = 'kickertool.alert.dismissed';

interface Watch {
  stop(): void;
}

/**
 * Sagt dem Spieler, wann er dran ist: Sobald eines seiner Matches in einem laufenden Turnier einem Tisch zugewiesen wird,
 * erscheint ein Hinweis mit Tisch, Partner und Gegnern (`calls`), dazu Vibration, Ton und, wenn die Seite gerade nicht
 * sichtbar ist, eine Systembenachrichtigung. Das gilt auf jeder Seite der App, nicht nur auf der Turnierseite.
 *
 * Dafür beobachtet der Dienst jedes laufende Turnier, in dem der Spieler angemeldet ist, über die Live-Updates und lädt
 * bei jeder Änderung seine Matches neu. Läuft die App nicht (Seite geschlossen, Handy gesperrt, Browser im Hintergrund
 * angehalten), kommt nichts an: Dafür bräuchte es echtes Web-Push mit Unterstützung im Backend.
 */
@Injectable({ providedIn: 'root' })
export class TurnAlerts {
  private readonly api = inject(KickerApi);
  private readonly auth = inject(AuthService);
  private readonly live = inject(LiveUpdates);
  private readonly effects = inject(ALERT_EFFECTS);

  private readonly byTournament = signal<Record<string, TurnCall[]>>({});
  private readonly dismissed = signal<ReadonlySet<string>>(new Set(readList(DISMISSED_KEY)));
  private readonly seen = new Set(readList(SEEN_KEY));
  private readonly watches = new Map<string, Watch>();
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  /** Die Matches, bei denen der Spieler jetzt dran ist und die er noch nicht weggeklickt hat. */
  readonly calls = computed(() =>
    Object.values(this.byTournament())
      .flat()
      .filter((call) => !this.dismissed().has(call.matchId))
      .sort((a, b) => a.table - b.table),
  );

  readonly soundOn = signal(readSound());
  readonly permission = signal<NotificationState>(this.effects.permission());
  /** Systembenachrichtigungen sind möglich, aber noch nicht erlaubt: Das Menü bietet es an. */
  readonly canAskPermission = computed(() => this.permission() === 'default');

  /** Beginnt zu beobachten. Mehrfaches Aufrufen schadet nicht. */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    void this.refresh();
    this.refreshTimer = setInterval(() => void this.refresh(), TOURNAMENT_REFRESH_MS);
  }

  /** Hört auf (Abmelden) und vergisst die Hinweise. */
  stop(): void {
    this.running = false;
    clearInterval(this.refreshTimer);
    this.watches.forEach((watch) => watch.stop());
    this.watches.clear();
    this.byTournament.set({});
  }

  /** „Verstanden“: Der Hinweis verschwindet, auch nach dem Neuladen der Seite. */
  dismiss(matchId: string): void {
    this.dismissed.update((set) => new Set(set).add(matchId));
    writeList(DISMISSED_KEY, [...this.dismissed()]);
  }

  setSound(on: boolean): void {
    this.soundOn.set(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // Speicher gesperrt: gilt dann nur bis zum Neuladen
    }
  }

  async enableSystemNotifications(): Promise<void> {
    this.permission.set(await this.effects.requestPermission());
  }

  /** Sucht die laufenden Turniere, in denen der Spieler angemeldet ist, und beobachtet sie. */
  private async refresh(): Promise<void> {
    const me = this.auth.me()?.id;
    if (me === undefined) {
      return;
    }
    try {
      const running = (await firstValueFrom(this.api.tournaments())).filter((entry) => entry.status === 'RUNNING');
      const wanted = new Set<string>();
      await Promise.all(
        running.map(async (entry) => {
          if (this.watches.has(entry.id)) {
            wanted.add(entry.id);
            return;
          }
          const detail = await firstValueFrom(this.api.tournament(entry.id));
          if (detail.participants.some((participant) => participant.player.id === me)) {
            wanted.add(entry.id);
            if (this.running && !this.watches.has(entry.id)) {
              this.watches.set(entry.id, this.watch(entry.id, detail.name, me));
            }
          }
        }),
      );
      for (const [id, watch] of this.watches) {
        if (!wanted.has(id)) {
          watch.stop();
          this.watches.delete(id);
          this.byTournament.update((state) => Object.fromEntries(Object.entries(state).filter(([key]) => key !== id)));
        }
      }
    } catch {
      // Backend nicht erreichbar: der nächste Durchlauf versucht es wieder
    }
  }

  private watch(tournamentId: string, name: string, me: string): Watch {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let loadedOnce = false;
    let stopped = false;

    const load = async () => {
      try {
        const matches = await firstValueFrom(this.api.myMatches(tournamentId));
        if (!stopped) {
          this.apply(tournamentId, name, me, matches, loadedOnce);
          loadedOnce = true;
        }
      } catch {
        // der nächste Event oder die nächste Ersatz-Abfrage versucht es wieder
      }
    };

    const subscription: Subscription = this.live.watch(tournamentId).subscribe((message) => {
      if (message.kind === 'change') {
        clearTimeout(debounce);
        debounce = setTimeout(() => void load(), ALERT_DEBOUNCE_MS);
        return;
      }
      if (message.status === 'live') {
        clearInterval(poll);
        poll = undefined;
      } else if (poll === undefined) {
        // Ohne Stream regelmäßig nachfragen, sonst käme der Hinweis nie
        poll = setInterval(() => void load(), FALLBACK_POLL_MS);
      }
      if (message.status === 'connecting' && !loadedOnce) {
        void load();
      }
    });

    return {
      stop: () => {
        stopped = true;
        subscription.unsubscribe();
        clearTimeout(debounce);
        clearInterval(poll);
      },
    };
  }

  /** Übernimmt den Stand der eigenen Matches und meldet die, die neu an einen Tisch gekommen sind. */
  private apply(tournamentId: string, name: string, me: string, matches: Match[], announce: boolean): void {
    const calls = matches
      .filter((match) => match.status === 'ON_TABLE' && match.table !== null)
      .flatMap((match) => {
        const people = pairing(match, me);
        return people === null
          ? []
          : [{ ...people, matchId: match.id, tournamentId, tournamentName: name, round: match.round, table: match.table! }];
      });
    this.byTournament.update((state) => ({ ...state, [tournamentId]: calls }));

    const fresh = calls.filter((call) => !this.seen.has(call.matchId));
    fresh.forEach((call) => this.seen.add(call.matchId));
    if (fresh.length > 0) {
      writeList(SEEN_KEY, [...this.seen]);
    }
    // Beim ersten Laden steht der Hinweis schon da, aber ohne Ton: Es ist nichts Neues passiert
    if (announce) {
      fresh.forEach((call) => this.effects.announce(call, { sound: this.soundOn() }));
    }
  }
}

function readList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, values: string[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(values));
  } catch {
    // Speicher gesperrt: nach dem Neuladen kann derselbe Hinweis noch einmal kommen
  }
}

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
