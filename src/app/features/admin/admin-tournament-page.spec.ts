import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Player, Round, Tournament } from '../../api/models';
import { fieldByLabel } from '../../testing/dom';
import { ANNA, BEN, CAN_DECIDE, CLARA, DAVID, match, participant, round, tournament } from '../../testing/fixtures';
import { AdminTournamentPage } from './admin-tournament-page';

const BASE = 'http://localhost:8080/api/tournaments/t1';
const PLAYERS = 'http://localhost:8080/api/players';

describe('AdminTournamentPage', () => {
  let fixture: ComponentFixture<AdminTournamentPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminTournamentPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminTournamentPage);
    fixture.componentRef.setInput('id', 't1');
    fixture.detectChanges();
    await Promise.resolve();
  });

  afterEach(() => http.verify());

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.trim() === label);

  async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  }

  /** Beantwortet das Laden von Turnier, Runden und Spielern. */
  async function load(t: Tournament, rounds: Round[] = [], players: Player[] = []): Promise<void> {
    // Ein Neuladen (`reload()`) startet die Anfragen erst mit der nächsten Änderungserkennung
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(BASE).flush(t);
    http.expectOne(`${BASE}/rounds`).flush(rounds);
    http.expectOne(PLAYERS).flush(players);
    await fixture.whenStable();
  }

  async function openTab(label: string): Promise<void> {
    Array.from(element().querySelectorAll<HTMLElement>('[role="tab"]'))
      .find((entry) => entry.textContent!.trim() === label)!
      .click();
    await fixture.whenStable();
  }

  async function type(label: string, value: string): Promise<void> {
    const input = fieldByLabel(element(), label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  const running = (overrides: Partial<Tournament> = {}) =>
    tournament({ status: 'RUNNING', roundCount: 1, participants: [participant(ANNA), participant(BEN)], ...overrides });

  it('zeigt Name, Status und bei einem geplanten Turnier „Turnier starten“', async () => {
    await load(tournament({ participants: [participant(ANNA)] }));

    expect(text()).toContain('Demo-Turnier');
    expect(text()).toContain('Geplant');
    expect(text()).toContain('1 Spieler');
    expect(button('Turnier starten')).toBeDefined();
    expect(button('Nächste Runde auslosen')).toBeUndefined();
    expect(text()).toContain('Noch keine Runde ausgelost.');
  });

  it('startet das Turnier und lädt danach neu', async () => {
    await load(tournament());

    button('Turnier starten')!.click();
    http.expectOne({ method: 'POST', url: `${BASE}/start` }).flush(running());
    await settle();

    await load(running(), [round(1, [match()])]);
    expect(text()).toContain('Läuft');
    expect(button('Turnier starten')).toBeUndefined();
    expect(text()).toContain('Runde 1');
  });

  it('sperrt die nächste Runde und das Beenden, solange Ergebnisse offen sind', async () => {
    await load(running({ currentRound: round(1, [match()], false) }), [round(1, [match()], false)]);

    expect(button('Nächste Runde auslosen')!.disabled).toBe(true);
    expect(button('Turnier beenden')!.disabled).toBe(true);
    expect(text()).toContain('Erst möglich, wenn alle Ergebnisse der aktuellen Runde bestätigt sind.');
  });

  it('lost die nächste Runde aus, wenn die letzte komplett ist', async () => {
    const done = round(1, [match({ status: 'CONFIRMED' })], true);
    await load(running({ currentRound: done }), [done]);
    expect(button('Nächste Runde auslosen')!.disabled).toBe(false);

    button('Nächste Runde auslosen')!.click();
    http.expectOne({ method: 'POST', url: `${BASE}/rounds` }).flush(running({ roundCount: 2 }));
    await settle();

    await load(running({ roundCount: 2 }), [done, round(2, [match({ id: 'm2', round: 2 })])]);
    expect(text()).toContain('Runde 2');
  });

  it('fragt vor dem Beenden nach', async () => {
    const done = round(1, [match({ status: 'CONFIRMED' })], true);
    await load(running({ currentRound: done }), [done]);

    button('Turnier beenden')!.click();
    await fixture.whenStable();
    expect(text()).toContain('Das Turnier endet endgültig');
    http.expectNone(`${BASE}/finish`);

    button('Ja, Turnier beenden')!.click();
    http.expectOne({ method: 'POST', url: `${BASE}/finish` }).flush(tournament({ status: 'FINISHED' }));
    await settle();

    await load(tournament({ status: 'FINISHED', roundCount: 1 }), [done]);
    expect(text()).toContain('Beendet');
    expect(button('Turnier beenden')).toBeUndefined();
  });

  it('verlinkt die Anzeige für weitere Bildschirme in einem neuen Fenster', async () => {
    await load(tournament());

    const link = Array.from(element().querySelectorAll('a')).find((entry) => entry.textContent!.includes('Anzeige öffnen'))!;
    expect(link.getAttribute('href')).toBe('/anzeige/t1');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('weist auf Streitfälle hin und legt ein Ergebnis fest', async () => {
    const disputed = match({
      status: 'DISPUTED',
      permissions: CAN_DECIDE,
      result: { goalsA: 10, goalsB: 8, confirmed: false, enteredBy: ANNA, enteredSide: 'A', source: null },
    });
    await load(running({ currentRound: round(1, [disputed]) }), [round(1, [disputed])]);
    expect(text()).toContain('1 Streitfall wartet auf deine Entscheidung.');

    button('Ergebnis festlegen')!.click();
    await fixture.whenStable();
    const [a, b] = Array.from(element().querySelectorAll<HTMLInputElement>('app-admin-match-card input'));
    a.value = '10';
    a.dispatchEvent(new Event('input'));
    b.value = '9';
    b.dispatchEvent(new Event('input'));
    element().querySelector('app-admin-match-card form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne({ method: 'PUT', url: `${BASE}/matches/m1/result` });
    expect(request.request.body).toEqual({ goalsA: 10, goalsB: 9 });
    request.flush(match({ status: 'CONFIRMED' }));
    await settle();

    await load(running(), [round(1, [match({ status: 'CONFIRMED' })], true)]);
    expect(text()).not.toContain('Streitfall');
  });

  it('zeigt die Runden mit der neuesten zuerst', async () => {
    await load(running({ roundCount: 2 }), [round(1, [match({ id: 'a' })], true), round(2, [match({ id: 'b', round: 2 })])]);

    const headings = Array.from(element().querySelectorAll('h2')).map((entry) => entry.textContent!.replace(/\s+/g, ' ').trim());
    expect(headings).toEqual(['Runde 2 läuft', 'Runde 1 abgeschlossen']);
  });

  it('meldet einen anderen Spieler an', async () => {
    await load(tournament({ participants: [participant(ANNA)] }), [], [ANNA, CLARA]);
    await openTab('Spieler');

    const select = element().querySelector('select')!;
    select.value = CLARA.id;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    button('Anmelden')!.click();

    const request = http.expectOne({ method: 'POST', url: `${BASE}/participants` });
    expect(request.request.body).toEqual({ playerId: CLARA.id });
    request.flush(tournament({ participants: [participant(ANNA), participant(CLARA)] }));
    await settle();

    await load(tournament({ participants: [participant(ANNA), participant(CLARA)] }), [], [ANNA, CLARA]);
    expect(text()).toContain('Clara Beispiel');
  });

  it('lässt einen Spieler vor dem Start abmelden und im laufenden Turnier pausieren', async () => {
    await load(tournament({ participants: [participant(ANNA)] }));
    await openTab('Spieler');

    button('Abmelden')!.click();
    http.expectOne({ method: 'DELETE', url: `${BASE}/participants/${ANNA.id}` }).flush(tournament());
    await settle();

    await load(running({ participants: [participant(BEN)] }));
    button('Pausieren')!.click();
    const request = http.expectOne({ method: 'PUT', url: `${BASE}/participants/${BEN.id}/status` });
    expect(request.request.body).toEqual({ status: 'PAUSED' });
    request.flush(running());
    await settle();
    await load(running({ participants: [participant(BEN, 'PAUSED')] }));
    expect(text()).toContain('Pausiert');
  });

  it('ändert nur den Namen, wenn nur der Name geändert wurde', async () => {
    await load(tournament());
    await openTab('Einstellungen');

    await type('Name', 'Neuer Name');
    element().querySelector('app-tournament-form form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne({ method: 'PUT', url: BASE });
    expect(request.request.body).toEqual({ name: 'Neuer Name', date: '2026-10-31' });
    request.flush(tournament({ name: 'Neuer Name' }));
    await settle();

    http.expectNone(`${BASE}/config`);
    await load(tournament({ name: 'Neuer Name' }));
    expect(text()).toContain('Neuer Name');
  });

  it('ersetzt nur die Konfiguration, wenn nur sie geändert wurde, etwa bei einem ausgefallenen Tisch', async () => {
    await load(running());
    await openTab('Einstellungen');

    await type('Anzahl Tische', '2');
    element().querySelector('app-tournament-form form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne({ method: 'PUT', url: `${BASE}/config` });
    expect(request.request.body).toEqual({
      tableCount: 2,
      goalLimit: 10,
      matchMinutes: 5,
      randomRounds: 2,
      plannedRounds: null,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
    });
    request.flush(running());
    await settle();

    await load(running());
  });

  it('zeigt die Meldung des Backends und lädt trotzdem neu, wenn eine Aktion abgelehnt wird', async () => {
    await load(tournament());

    button('Turnier starten')!.click();
    http
      .expectOne({ method: 'POST', url: `${BASE}/start` })
      .flush({ detail: 'Zum Start braucht es mindestens 4 Spieler.' }, { status: 409, statusText: 'Conflict' });
    await settle();

    await load(tournament({ participants: [participant(DAVID)] }));
    expect(document.body.textContent).toContain('Zum Start braucht es mindestens 4 Spieler.');
  });

  it('bietet bei einem Ladefehler an, es erneut zu versuchen', async () => {
    fixture.detectChanges();
    http.expectOne(BASE).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable().catch(() => undefined);
    fixture.detectChanges();

    expect(text()).toContain('Das Turnier konnte nicht geladen werden.');
    http.match(() => true);
  });
});
