import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { KickerApi } from '../../api/kicker-api';
import { Match, Tournament, TournamentSummary } from '../../api/models';
import { ANNA, BEN, match, participant, tournament } from '../../testing/fixtures';
import { AuthService } from '../auth/auth.service';
import { LiveMessage, LiveUpdates } from '../events/live-updates';
import { ALERT_EFFECTS } from './alert-effects';
import { ALERT_DEBOUNCE_MS, FALLBACK_POLL_MS, TOURNAMENT_REFRESH_MS, TurnAlerts } from './turn-alerts';

function summary(id: string, status: TournamentSummary['status'] = 'RUNNING'): TournamentSummary {
  return { id, name: `Turnier ${id}`, date: '2026-10-31', status, participantCount: 4, roundCount: 1 };
}

function detail(id: string, withMe: boolean): Tournament {
  return tournament({
    id,
    name: `Turnier ${id}`,
    status: 'RUNNING',
    participants: withMe ? [participant(ANNA), participant(BEN)] : [participant(BEN)],
  });
}

describe('TurnAlerts', () => {
  let alerts: TurnAlerts;
  let me: ReturnType<typeof signal<{ id: string } | null>>;
  let streams: Map<string, Subject<LiveMessage>>;
  let list: TournamentSummary[];
  let details: Record<string, Tournament>;
  let mine: Record<string, Match[]>;
  let api: { tournaments: ReturnType<typeof vi.fn>; tournament: ReturnType<typeof vi.fn>; myMatches: ReturnType<typeof vi.fn> };
  let effects: {
    announce: ReturnType<typeof vi.fn>;
    permission: ReturnType<typeof vi.fn>;
    requestPermission: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    me = signal<{ id: string } | null>({ id: ANNA.id });
    streams = new Map();
    list = [summary('t1')];
    details = { t1: detail('t1', true) };
    mine = { t1: [] };
    api = {
      tournaments: vi.fn(() => of(list)),
      tournament: vi.fn((id: string) => of(details[id])),
      myMatches: vi.fn((id: string) => of(mine[id] ?? [])),
    };
    effects = {
      announce: vi.fn(),
      permission: vi.fn(() => 'default'),
      requestPermission: vi.fn(() => Promise.resolve('granted')),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: KickerApi, useValue: api },
        { provide: AuthService, useValue: { me } },
        { provide: ALERT_EFFECTS, useValue: effects },
        {
          provide: LiveUpdates,
          useValue: {
            watch: (id: string): Observable<LiveMessage> => {
              const stream = streams.get(id) ?? new Subject<LiveMessage>();
              streams.set(id, stream);
              return stream.asObservable();
            },
          },
        },
      ],
    });
    alerts = TestBed.inject(TurnAlerts);
  });

  afterEach(() => {
    alerts.stop();
    vi.useRealTimers();
  });

  const flush = () => vi.advanceTimersByTimeAsync(0);
  const stream = (id = 't1') => streams.get(id)!;

  /** Startet und lässt den Stream „verbinden“, wie es der echte Dienst sofort tut. */
  async function begin(id = 't1'): Promise<void> {
    alerts.start();
    await flush();
    stream(id).next({ kind: 'status', status: 'connecting' });
    await flush();
  }

  /** Ein Live-Update trifft ein, nach der Bündelung wird nachgeladen. */
  async function change(id = 't1'): Promise<void> {
    stream(id).next({ kind: 'change', resync: false });
    await vi.advanceTimersByTimeAsync(ALERT_DEBOUNCE_MS);
  }

  const onTable = (id: string, extra: Partial<Match> = {}) => match({ id, status: 'ON_TABLE', table: 2, round: 3, ...extra });
  const queued = (id: string) => match({ id, status: 'QUEUED', table: null });

  it('beobachtet nur laufende Turniere, in denen der Spieler angemeldet ist', async () => {
    list = [summary('t1'), summary('t2'), summary('t3', 'PLANNED'), summary('t4', 'FINISHED')];
    details = { t1: detail('t1', true), t2: detail('t2', false) };

    alerts.start();
    await flush();

    expect([...streams.keys()]).toEqual(['t1']);
    expect(api.tournament.mock.calls.map(([id]) => id).sort()).toEqual(['t1', 't2']);
  });

  it('tut ohne angemeldeten Nutzer nichts', async () => {
    me.set(null);

    alerts.start();
    await flush();

    expect(api.tournaments).not.toHaveBeenCalled();
  });

  it('zeigt einen Hinweis, wenn der Spieler schon beim ersten Laden am Tisch steht, aber ohne Ton und Vibration', async () => {
    mine = { t1: [onTable('m1')] };

    await begin();

    expect(alerts.calls()).toEqual([
      {
        matchId: 'm1',
        tournamentId: 't1',
        tournamentName: 'Turnier t1',
        round: 3,
        table: 2,
        partner: 'Ben Beispiel',
        opponents: ['Clara Beispiel', 'David Beispiel'],
      },
    ]);
    expect(effects.announce).not.toHaveBeenCalled();
  });

  it('meldet, sobald das wartende Match des Spielers einem Tisch zugewiesen wird', async () => {
    mine = { t1: [queued('m1')] };
    await begin();
    expect(alerts.calls()).toEqual([]);

    mine = { t1: [onTable('m1')] };
    await change();

    expect(alerts.calls().map((call) => call.table)).toEqual([2]);
    expect(effects.announce).toHaveBeenCalledTimes(1);
    expect(effects.announce.mock.calls[0][0]).toMatchObject({ matchId: 'm1', table: 2, tournamentName: 'Turnier t1' });
    expect(effects.announce.mock.calls[0][1]).toEqual({ sound: true });
  });

  it('meldet auch eine neue Runde mit neuem Match', async () => {
    mine = { t1: [{ ...onTable('r1'), status: 'CONFIRMED' }] };
    await begin();

    mine = { t1: [{ ...onTable('r1'), status: 'CONFIRMED' }, onTable('r2', { round: 4, table: 1 })] };
    await change();

    expect(effects.announce).toHaveBeenCalledTimes(1);
    expect(alerts.calls().map((call) => [call.matchId, call.round, call.table])).toEqual([['r2', 4, 1]]);
  });

  it('meldet dasselbe Match nicht noch einmal', async () => {
    mine = { t1: [queued('m1')] };
    await begin();
    mine = { t1: [onTable('m1')] };
    await change();

    await change();
    await change();

    expect(effects.announce).toHaveBeenCalledTimes(1);
  });

  it('fasst mehrere Events kurz hintereinander zu einer Abfrage zusammen', async () => {
    await begin();
    api.myMatches.mockClear();

    stream().next({ kind: 'change', resync: false });
    stream().next({ kind: 'change', resync: false });
    stream().next({ kind: 'change', resync: true });
    await vi.advanceTimersByTimeAsync(ALERT_DEBOUNCE_MS);

    expect(api.myMatches).toHaveBeenCalledTimes(1);
  });

  it('nimmt den Hinweis zurück, wenn das Match nicht mehr am Tisch ist', async () => {
    mine = { t1: [onTable('m1')] };
    await begin();
    expect(alerts.calls().length).toBe(1);

    mine = { t1: [onTable('m1', { status: 'RESULT_ENTERED' })] };
    await change();

    expect(alerts.calls()).toEqual([]);
  });

  it('ignoriert Matches, in denen der Spieler nicht steht, und solche ohne Tisch', async () => {
    mine = { t1: [onTable('fremd', { mySide: null }), queued('wartet'), onTable('ohne-tisch', { table: null })] };

    await begin();

    expect(alerts.calls()).toEqual([]);
  });

  it('meldet gleichzeitig mehrere Turniere und sortiert nach Tisch', async () => {
    list = [summary('t1'), summary('t2')];
    details = { t1: detail('t1', true), t2: detail('t2', true) };
    mine = { t1: [onTable('a', { table: 3 })], t2: [onTable('b', { table: 1 })] };

    alerts.start();
    await flush();
    stream('t1').next({ kind: 'status', status: 'connecting' });
    stream('t2').next({ kind: 'status', status: 'connecting' });
    await flush();

    expect(alerts.calls().map((call) => [call.tournamentName, call.table])).toEqual([
      ['Turnier t2', 1],
      ['Turnier t1', 3],
    ]);
  });

  describe('„Verstanden“', () => {
    it('blendet den Hinweis aus und auch nach neuem Laden nicht wieder ein', async () => {
      mine = { t1: [onTable('m1')] };
      await begin();

      alerts.dismiss('m1');
      expect(alerts.calls()).toEqual([]);

      await change();
      expect(alerts.calls()).toEqual([]);
    });

    it('gilt auch nach dem Neuladen der Seite', async () => {
      mine = { t1: [onTable('m1')] };
      await begin();
      alerts.dismiss('m1');
      alerts.stop();
      TestBed.resetTestingModule();

      TestBed.configureTestingModule({
        providers: [
          { provide: KickerApi, useValue: api },
          { provide: AuthService, useValue: { me } },
          { provide: ALERT_EFFECTS, useValue: effects },
          { provide: LiveUpdates, useValue: { watch: () => new Subject<LiveMessage>() } },
        ],
      });
      const reloaded = TestBed.inject(TurnAlerts);
      reloaded.start();
      await flush();

      expect(reloaded.calls()).toEqual([]);
      reloaded.stop();
    });
  });

  it('meldet nach dem Neuladen der Seite nichts, was schon gemeldet wurde', async () => {
    mine = { t1: [queued('m1')] };
    await begin();
    mine = { t1: [onTable('m1')] };
    await change();
    alerts.stop();
    effects.announce.mockClear();

    const next = new Subject<LiveMessage>();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: KickerApi, useValue: api },
        { provide: AuthService, useValue: { me } },
        { provide: ALERT_EFFECTS, useValue: effects },
        { provide: LiveUpdates, useValue: { watch: () => next.asObservable() } },
      ],
    });
    const reloaded = TestBed.inject(TurnAlerts);
    reloaded.start();
    await flush();
    next.next({ kind: 'status', status: 'connecting' });
    await flush();
    next.next({ kind: 'change', resync: false });
    await vi.advanceTimersByTimeAsync(ALERT_DEBOUNCE_MS);

    expect(reloaded.calls().length).toBe(1);
    expect(effects.announce).not.toHaveBeenCalled();
    reloaded.stop();
  });

  describe('ohne Live-Verbindung', () => {
    it('fragt in Abständen nach, bis der Stream steht', async () => {
      mine = { t1: [queued('m1')] };
      await begin();
      api.myMatches.mockClear();

      mine = { t1: [onTable('m1')] };
      await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS);

      expect(api.myMatches).toHaveBeenCalledTimes(1);
      expect(effects.announce).toHaveBeenCalledTimes(1);

      stream().next({ kind: 'status', status: 'live' });
      api.myMatches.mockClear();
      await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS * 3);
      expect(api.myMatches).not.toHaveBeenCalled();
    });

    it('fragt wieder nach, wenn die Verbindung abreißt', async () => {
      await begin();
      stream().next({ kind: 'status', status: 'live' });
      api.myMatches.mockClear();

      stream().next({ kind: 'status', status: 'offline' });
      await vi.advanceTimersByTimeAsync(FALLBACK_POLL_MS);

      expect(api.myMatches).toHaveBeenCalledTimes(1);
    });
  });

  describe('Turniere kommen und gehen', () => {
    it('beobachtet ein später begonnenes Turnier beim nächsten Durchlauf', async () => {
      list = [];
      alerts.start();
      await flush();
      expect(streams.size).toBe(0);

      list = [summary('t1')];
      await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS);

      expect([...streams.keys()]).toEqual(['t1']);
    });

    it('beobachtet ein Turnier, in dem der Spieler sich erst später anmeldet', async () => {
      details = { t1: detail('t1', false) };
      alerts.start();
      await flush();
      expect(streams.size).toBe(0);

      details = { t1: detail('t1', true) };
      await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS);

      expect([...streams.keys()]).toEqual(['t1']);
    });

    it('beendet die Beobachtung und nimmt den Hinweis zurück, wenn das Turnier endet', async () => {
      mine = { t1: [onTable('m1')] };
      await begin();
      expect(stream().observed).toBe(true);

      list = [summary('t1', 'FINISHED')];
      await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS);

      expect(stream().observed).toBe(false);
      expect(alerts.calls()).toEqual([]);
    });

    it('beobachtet ein laufendes Turnier nicht doppelt', async () => {
      await begin();

      await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS * 3);

      expect(api.tournament).toHaveBeenCalledTimes(1);
      expect(streams.size).toBe(1);
    });

    it('übersteht ein nicht erreichbares Backend und versucht es später wieder', async () => {
      api.tournaments.mockReturnValueOnce(throwError(() => new Error('Netz weg')));

      alerts.start();
      await flush();
      expect(streams.size).toBe(0);

      await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS);
      expect([...streams.keys()]).toEqual(['t1']);
    });
  });

  it('hört beim Beenden auf und vergisst die Hinweise', async () => {
    mine = { t1: [onTable('m1')] };
    await begin();

    alerts.stop();

    expect(alerts.calls()).toEqual([]);
    expect(stream().observed).toBe(false);
    api.tournaments.mockClear();
    await vi.advanceTimersByTimeAsync(TOURNAMENT_REFRESH_MS * 2);
    expect(api.tournaments).not.toHaveBeenCalled();
  });

  it('startet nicht doppelt', async () => {
    alerts.start();
    alerts.start();
    await flush();

    expect(api.tournaments).toHaveBeenCalledTimes(1);
  });

  describe('Ton und Benachrichtigungen', () => {
    it('merkt sich, wenn der Ton ausgeschaltet wird, und gibt das an die Wirkungen weiter', async () => {
      alerts.setSound(false);
      expect(alerts.soundOn()).toBe(false);
      expect(localStorage.getItem('kickertool.alert.sound')).toBe('off');

      mine = { t1: [queued('m1')] };
      await begin();
      mine = { t1: [onTable('m1')] };
      await change();

      expect(effects.announce.mock.calls[0][1]).toEqual({ sound: false });
    });

    it('hat den Ton standardmäßig an', () => {
      expect(alerts.soundOn()).toBe(true);
    });

    it('bietet die Systembenachrichtigung an, bis sie erlaubt ist', async () => {
      expect(alerts.canAskPermission()).toBe(true);

      await alerts.enableSystemNotifications();

      expect(effects.requestPermission).toHaveBeenCalled();
      expect(alerts.permission()).toBe('granted');
      expect(alerts.canAskPermission()).toBe(false);
    });

    it('bietet sie nicht an, wenn der Browser sie nicht kennt', () => {
      effects.permission.mockReturnValue('unsupported');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: KickerApi, useValue: api },
          { provide: AuthService, useValue: { me } },
          { provide: ALERT_EFFECTS, useValue: effects },
          { provide: LiveUpdates, useValue: { watch: () => new Subject<LiveMessage>() } },
        ],
      });

      expect(TestBed.inject(TurnAlerts).canAskPermission()).toBe(false);
    });
  });
});
