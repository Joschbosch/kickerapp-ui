import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Match, RankingEntry, Tournament } from '../../api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ANNA, BEN, match, participant, tournament } from '../../testing/fixtures';
import { TournamentDetailPage } from './tournament-detail-page';

const BASE = 'http://localhost:8080/api/tournaments/t1';

function entry(rank: number, player: typeof ANNA, points: number): RankingEntry {
  return {
    rank,
    player,
    points,
    status: 'ACTIVE',
    matchesPlayed: 1,
    wins: 1,
    draws: 0,
    losses: 0,
    goalsFor: 10,
    goalsAgainst: 5,
    goalDifference: 5,
  };
}

describe('TournamentDetailPage', () => {
  let fixture: ComponentFixture<TournamentDetailPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentDetailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { me: signal({ id: ANNA.id, displayName: ANNA.displayName, admin: false }), isAdmin: signal(false) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TournamentDetailPage);
    fixture.componentRef.setInput('id', 't1');
    fixture.detectChanges();
    await Promise.resolve();
  });

  afterEach(() => http.verify());

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.trim() === label);

  /** Beantwortet das Laden von Turnier, Rangliste und (falls angefragt) den eigenen Spielen. */
  async function load(t: Tournament, ranking: RankingEntry[] = [], mine?: Match[]): Promise<void> {
    // Ein Neuladen (`reload()`) startet die Anfragen erst mit der nächsten Änderungserkennung
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${BASE}`).flush(t);
    http.expectOne(`${BASE}/ranking`).flush(ranking);
    if (mine !== undefined) {
      await Promise.resolve();
      http.expectOne(`${BASE}/matches/mine`).flush(mine);
    }
    await fixture.whenStable();
  }

  it('zeigt Nicht-Angemeldeten die Anmeldung und die Rangliste, ohne eigene Spiele zu laden', async () => {
    await load(tournament({ participants: [participant(BEN)] }), [entry(1, BEN, 3)]);

    expect(text()).toContain('Demo-Turnier');
    expect(text()).toContain('Du bist noch nicht angemeldet.');
    expect(text()).not.toContain('Mein Spiel');
    expect(text()).toContain('Ben Beispiel');
  });

  it('meldet an und lädt danach den neuen Stand', async () => {
    await load(tournament());

    button('Anmelden')!.click();
    const request = http.expectOne({ method: 'POST', url: `${BASE}/participants` });
    expect(request.request.body).toEqual({});
    request.flush(tournament({ participants: [participant(ANNA)] }));
    await Promise.resolve();
    await Promise.resolve();

    await load(tournament({ participants: [participant(ANNA)] }), [], []);
    expect(text()).toContain('Du bist dabei.');
  });

  it('zeigt Angemeldeten im laufenden Turnier ihr Spiel und markiert sie in der Rangliste', async () => {
    await load(
      tournament({ status: 'RUNNING', roundCount: 1, participants: [participant(ANNA), participant(BEN)] }),
      [entry(1, BEN, 3), entry(2, ANNA, 0)],
      [match({ permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false } })],
    );

    expect(text()).toContain('Mein Spiel');
    expect(text()).toContain('Tisch 1 – jetzt spielen');
    expect(button('Ergebnis eintragen')).toBeDefined();
    const rows = element().querySelectorAll('tr.me');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Anna Beispiel');
  });

  it('trennt das aktuelle Spiel von den bisherigen', async () => {
    await load(
      tournament({ status: 'RUNNING', roundCount: 2, participants: [participant(ANNA)] }),
      [],
      [match({ id: 'm-old', round: 1, status: 'CONFIRMED', table: 1 }), match({ id: 'm-new', round: 2, table: 2 })],
    );

    const lists = element().querySelectorAll('ul.matches');
    expect(lists.length).toBe(2);
    expect(lists[0].textContent).toContain('Tisch 2 – jetzt spielen');
    expect(text()).toContain('Bisherige Spiele');
  });

  it('sagt, wenn der Spieler in der aktuellen Runde nicht spielt', async () => {
    await load(
      tournament({ status: 'RUNNING', roundCount: 2, participants: [participant(ANNA, 'PAUSED')] }),
      [],
      [match({ round: 1, status: 'CONFIRMED' })],
    );

    expect(text()).toContain('In Runde 2 hast du kein Spiel.');
  });

  it('trägt ein Ergebnis ein und lädt danach neu', async () => {
    await load(
      tournament({ status: 'RUNNING', roundCount: 1, participants: [participant(ANNA)] }),
      [],
      [match({ permissions: { canEnterResult: true, canConfirm: false, canReject: false, canDecide: false } })],
    );

    button('Ergebnis eintragen')!.click();
    await fixture.whenStable();
    const [mine, opponent] = Array.from(element().querySelectorAll('input'));
    mine.value = '10';
    mine.dispatchEvent(new Event('input'));
    opponent.value = '4';
    opponent.dispatchEvent(new Event('input'));
    element().querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne({ method: 'POST', url: `${BASE}/matches/m1/result-proposal` });
    expect(request.request.body).toEqual({ goalsA: 10, goalsB: 4 });
    request.flush(match());
    await Promise.resolve();
    await Promise.resolve();

    await load(
      tournament({ status: 'RUNNING', roundCount: 1, participants: [participant(ANNA)] }),
      [],
      [match({ status: 'RESULT_ENTERED' })],
    );
    expect(text()).toContain('Ergebnis eingetragen');
  });

  it('zeigt die Meldung des Backends, wenn eine Aktion abgelehnt wird', async () => {
    await load(tournament());

    button('Anmelden')!.click();
    http
      .expectOne({ method: 'POST', url: `${BASE}/participants` })
      .flush({ detail: 'Das Turnier ist bereits beendet.' }, { status: 409, statusText: 'Conflict' });
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Das Turnier ist bereits beendet.');
  });
});
