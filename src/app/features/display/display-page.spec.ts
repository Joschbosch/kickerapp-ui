import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RankingEntry, Tournament } from '../../api/models';
import { ANNA, BEN, CLARA, DAVID, match, participant, rankingEntry, round, tournament } from '../../testing/fixtures';
import { LIVE_DEBOUNCE_MS } from '../../core/events/live-reload';
import { controlledLiveUpdates } from '../../testing/live';
import { DisplayPage, REFRESH_MS } from './display-page';

const BASE = 'http://localhost:8080/api/tournaments/t1';

describe('DisplayPage', () => {
  let fixture: ComponentFixture<DisplayPage>;
  let http: HttpTestingController;
  let live: ReturnType<typeof controlledLiveUpdates>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    live = controlledLiveUpdates();
    await TestBed.configureTestingModule({
      imports: [DisplayPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), live.provider],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DisplayPage);
    fixture.componentRef.setInput('id', 't1');
    fixture.detectChanges();
    await Promise.resolve();
  });

  afterEach(() => {
    try {
      http.verify({ ignoreCancelled: true });
    } finally {
      vi.useRealTimers();
    }
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');

  /** Beantwortet das Laden von Turnier und Rangliste. */
  async function load(t: Tournament, ranking: RankingEntry[] = []): Promise<void> {
    http.expectOne(BASE).flush(t);
    http.expectOne(`${BASE}/ranking`).flush(ranking);
    await fixture.whenStable();
  }

  /** Lässt die Zeit bis zur nächsten Aktualisierung vergehen. */
  async function nextRefresh(): Promise<void> {
    vi.advanceTimersByTime(REFRESH_MS);
    fixture.detectChanges();
    await Promise.resolve();
  }

  const running = (overrides: Partial<Tournament> = {}) =>
    tournament({ status: 'RUNNING', roundCount: 1, participants: [participant(ANNA)], ...overrides });

  it('zeigt Rangliste, Tische und die Warteschlange', async () => {
    const current = round(1, [
      match({ id: 'm2', position: 2, table: 2, teamA: match().teamB, teamB: match().teamA }),
      match({ id: 'm1', position: 1, table: 1 }),
      match({
        id: 'm3',
        position: 3,
        table: null,
        status: 'QUEUED',
        teamA: { members: [{ type: 'DUMMY', player: null, standIn: null }, match().teamA.members[0]] },
      }),
      match({ id: 'm4', position: 4, table: 3, status: 'CONFIRMED' }),
    ]);
    await load(running({ currentRound: current }), [rankingEntry(1, BEN, 6), rankingEntry(2, ANNA, 3, 'PAUSED')]);

    expect(text()).toContain('Demo-Turnier');
    expect(text()).toContain('Runde 1');
    const rows = Array.from(element().querySelectorAll('tbody tr')).map((row) => row.textContent!.replace(/\s+/g, ' ').trim());
    expect(rows[0]).toContain('Ben Beispiel');
    expect(rows[0]).toContain('6');
    expect(rows[1]).toContain('Anna Beispiel Pausiert');

    const tables = Array.from(element().querySelectorAll('.tables li')).map((entry) => entry.textContent!.replace(/\s+/g, ' ').trim());
    expect(tables.length).toBe(2);
    expect(tables[0]).toContain('Tisch 1');
    expect(tables[0]).toContain('Anna Beispiel');
    expect(tables[1]).toContain('Tisch 2');

    expect(text()).toContain('1 von 4 Spielen gespielt');
    expect(text()).toContain('Als Nächstes');
    expect(element().querySelector('.queue')!.textContent).toContain('Gast & Anna Beispiel');
  });

  it('zeigt „Runde x von y“, wenn die Rundenzahl geplant ist', async () => {
    const config = { ...tournament().config, plannedRounds: 8 };
    await load(running({ config, currentRound: round(1, [match()]) }));

    expect(text()).toContain('Runde 1 von 8');
  });

  it('sagt, solange das Turnier nicht läuft, wie es weitergeht', async () => {
    await load(tournament());
    expect(text()).toContain('Das Turnier hat noch nicht begonnen.');
    expect(text()).toContain('Noch keine Spieler angemeldet.');

    await nextRefresh();
    await load(tournament({ status: 'FINISHED', roundCount: 2 }), [rankingEntry(1, ANNA, 6)]);
    expect(text()).toContain('Das Turnier ist beendet.');
  });

  it('weist darauf hin, wenn alle Tische frei sind und nur noch Ergebnisse fehlen', async () => {
    const waiting = round(1, [match({ status: 'RESULT_ENTERED' })]);
    await load(running({ currentRound: waiting }));

    expect(text()).toContain('Alle Tische sind frei, die Ergebnisse werden noch bestätigt.');
  });

  it('aktualisiert sich von selbst', async () => {
    await load(running({ currentRound: round(1, [match()]) }), [rankingEntry(1, ANNA, 0)]);
    expect(text()).toContain('Tisch 1');

    await nextRefresh();
    await load(
      running({ roundCount: 2, currentRound: round(2, [match({ id: 'n1', round: 2, table: 4, teamA: { members: [match().teamB.members[0], match().teamB.members[1]] } })]) }),
      [rankingEntry(1, CLARA, 3), rankingEntry(2, DAVID, 3)],
    );

    expect(text()).toContain('Runde 2');
    expect(text()).toContain('Tisch 4');
    expect(text()).toContain('Clara Beispiel');
  });

  it('bleibt beim letzten Stand und meldet die gestörte Verbindung, wenn eine Aktualisierung scheitert', async () => {
    await load(running({ currentRound: round(1, [match()]) }), [rankingEntry(1, ANNA, 0)]);

    await nextRefresh();
    http.expectOne(`${BASE}/ranking`).flush({}, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Verbindung gestört.');
    expect(text()).toContain('Tisch 1');
    expect(text()).toContain('Anna Beispiel');
  });

  it('fragt nicht doppelt an, solange die letzte Aktualisierung noch läuft', async () => {
    await load(running({ currentRound: round(1, [match()]) }));

    await nextRefresh();
    const open = http.match(() => true);
    expect(open.map((request) => request.request.url)).toEqual([BASE, `${BASE}/ranking`]);

    // Die Antworten stehen noch aus: Der nächste Takt startet nichts Neues
    vi.advanceTimersByTime(REFRESH_MS);
    fixture.detectChanges();
    await Promise.resolve();

    http.expectNone(() => true);
    for (const request of open) {
      request.flush(request.request.url === BASE ? running({ currentRound: round(1, [match()]) }) : []);
    }
    await fixture.whenStable();
  });

  it('bietet erneutes Laden an, wenn der erste Aufruf scheitert', async () => {
    http.expectOne(`${BASE}/ranking`).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Das Turnier konnte nicht geladen werden.');
    expect(text()).toContain('Zur Turnierliste');
  });

  it('lädt bei einem Live-Update sofort neu', async () => {
    await load(running({ currentRound: round(1, [match()]) }), [rankingEntry(1, ANNA, 0)]);
    live.messages.next({ kind: 'status', status: 'live' });
    await fixture.whenStable();
    expect(text()).toContain('Live');

    live.messages.next({ kind: 'change', resync: false });
    await new Promise((resolve) => setTimeout(resolve, LIVE_DEBOUNCE_MS + 50));
    fixture.detectChanges();
    await Promise.resolve();

    await load(running({ currentRound: round(1, [match()]) }), [rankingEntry(1, ANNA, 3)]);
    expect(element().querySelector('tbody tr .strong')!.textContent).toContain('3');
  });

  it('fragt bei stehender Live-Verbindung nicht in Abständen nach', async () => {
    await load(running({ currentRound: round(1, [match()]) }));
    live.messages.next({ kind: 'status', status: 'live' });
    await fixture.whenStable();

    vi.advanceTimersByTime(REFRESH_MS * 4);
    fixture.detectChanges();
    await Promise.resolve();

    http.expectNone(() => true);
  });

  it('fragt wieder in Abständen nach und zeigt „Offline“, wenn die Live-Verbindung abreißt', async () => {
    await load(running({ currentRound: round(1, [match()]) }));
    live.messages.next({ kind: 'status', status: 'live' });
    await fixture.whenStable();
    live.messages.next({ kind: 'status', status: 'offline' });
    await fixture.whenStable();
    expect(text()).toContain('Offline');

    await nextRefresh();

    await load(running({ currentRound: round(1, [match()]) }));
  });

  it('hört nach dem Schließen auf, nachzufragen', async () => {
    await load(running({ currentRound: round(1, [match()]) }));

    fixture.destroy();
    vi.advanceTimersByTime(REFRESH_MS * 3);

    http.expectNone(BASE);
  });
});
