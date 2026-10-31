import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TournamentSummary } from '../../api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ANNA, BEN, participant, tournament } from '../../testing/fixtures';
import { LIST_REFRESH_MS, TournamentListPage } from './tournament-list-page';

const URL = 'http://localhost:8080/api/tournaments';

describe('TournamentListPage', () => {
  let fixture: ComponentFixture<TournamentListPage>;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TournamentListPage);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('zeigt die Turniere mit Status und Spielerzahl', async () => {
    controller.expectOne(URL).flush([
      { id: 't1', name: 'Demo-Turnier', date: '2026-10-31', status: 'PLANNED', participantCount: 10, roundCount: 0 },
      { id: 't2', name: 'Freitagsrunde', date: '2026-10-30', status: 'RUNNING', participantCount: 8, roundCount: 3 },
    ] as TournamentSummary[]);
    await fixture.whenStable();

    expect(text()).toContain('Demo-Turnier');
    expect(text()).toContain('Geplant');
    expect(text()).toContain('10 Spieler');
    expect(text()).toContain('Freitagsrunde');
    expect(text()).toContain('Läuft');
    expect(text()).toContain('Runde 3');
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a.card');
    expect(links[0].getAttribute('href')).toBe('/turniere/t1');
  });

  it('sagt, wenn es noch kein Turnier gibt', async () => {
    controller.expectOne(URL).flush([]);
    await fixture.whenStable();

    expect(text()).toContain('Es gibt noch kein Turnier.');
  });

  it('zeigt normalen Spielern kein „Neues Turnier“', async () => {
    controller.expectOne(URL).flush([]);
    await fixture.whenStable();

    expect(text()).not.toContain('Neues Turnier');
  });

  it('bietet bei einem Fehler an, es erneut zu versuchen', async () => {
    controller.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(text()).toContain('Die Turniere konnten nicht geladen werden.');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')!.click();
    // Die Anfrage startet erst mit der nächsten Änderungserkennung; whenStable() wartet auf offene Anfragen, daher
    // erst beantworten
    fixture.detectChanges();
    await Promise.resolve();
    controller.expectOne(URL).flush([]);
    await fixture.whenStable();

    expect(text()).toContain('Es gibt noch kein Turnier.');
  });
});

describe('TournamentListPage als Admin', () => {
  it('bietet an, ein neues Turnier anzulegen', async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: signal(true), me: signal(null) } },
      ],
    }).compileComponents();
    const controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(TournamentListPage);
    fixture.detectChanges();
    controller.expectOne(URL).flush([]);
    await fixture.whenStable();

    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a')).find((entry) =>
      entry.textContent!.includes('Neues Turnier'),
    );
    expect(link!.getAttribute('href')).toBe('/admin/turniere/neu');
    controller.verify();
  });
});

describe('TournamentListPage als Spieler', () => {
  let controller: HttpTestingController;
  let fixture: ComponentFixture<TournamentListPage>;

  const summaries: TournamentSummary[] = [
    { id: 't1', name: 'Demo-Turnier', date: '2026-10-31', status: 'RUNNING', participantCount: 4, roundCount: 1 },
    { id: 't2', name: 'Freitagsrunde', date: '2026-10-30', status: 'PLANNED', participantCount: 2, roundCount: 0 },
    { id: 't3', name: 'Altes Turnier', date: '2026-09-01', status: 'FINISHED', participantCount: 8, roundCount: 5 },
  ];

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await TestBed.configureTestingModule({
      imports: [TournamentListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAdmin: signal(false), me: signal({ id: ANNA.id }) } },
      ],
    }).compileComponents();
    controller = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TournamentListPage);
    fixture.detectChanges();
  });

  afterEach(() => {
    try {
      controller.verify();
    } finally {
      vi.useRealTimers();
    }
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  /** Lässt Änderungserkennung und Effekte laufen, damit Anfragen starten (whenStable() würde auf sie warten). */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
      await Promise.resolve();
    }
  }

  /** Beantwortet die Liste und danach die Nachfragen, wo der Spieler angemeldet ist. */
  async function load(list: TournamentSummary[], registeredIn: string[]): Promise<void> {
    controller.expectOne(URL).flush(list);
    await settle();
    for (const entry of list) {
      controller
        .expectOne(`${URL}/${entry.id}`)
        .flush(tournament({ id: entry.id, participants: registeredIn.includes(entry.id) ? [participant(ANNA)] : [participant(BEN)] }));
    }
    await fixture.whenStable();
  }

  it('markiert die Turniere, in denen der Spieler angemeldet ist', async () => {
    await load(summaries, ['t1', 't3']);

    const cards = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li')).map((entry) =>
      entry.textContent!.replace(/\s+/g, ' '),
    );
    expect(cards[0]).toContain('Demo-Turnier');
    expect(cards[0]).toContain('Angemeldet');
    expect(cards[1]).toContain('Freitagsrunde');
    expect(cards[1]).not.toContain('Angemeldet');
    expect(cards[2]).toContain('Teilgenommen');
  });

  it('zeigt die Liste auch, wenn das Nachsehen für ein Turnier fehlschlägt', async () => {
    controller.expectOne(URL).flush(summaries.slice(0, 2));
    await settle();
    controller.expectOne(`${URL}/t1`).flush({}, { status: 500, statusText: 'Server Error' });
    controller.expectOne(`${URL}/t2`).flush(tournament({ id: 't2', participants: [participant(ANNA)] }));
    await fixture.whenStable();

    expect(text()).toContain('Demo-Turnier');
    expect(text()).toContain('Freitagsrunde');
    expect(text()).toContain('Angemeldet');
  });

  it('sieht höchstens bei den neuesten 20 Turnieren nach', async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...summaries[0], id: `t${index}` }));
    controller.expectOne(URL).flush(many);
    await settle();

    for (let index = 0; index < 20; index++) {
      controller.expectOne(`${URL}/t${index}`).flush(tournament({ id: `t${index}` }));
    }
    controller.expectNone(`${URL}/t20`);
    await fixture.whenStable();
  });

  it('lädt sich nach einer Weile von selbst neu', async () => {
    await load(summaries.slice(0, 1), ['t1']);

    vi.advanceTimersByTime(LIST_REFRESH_MS);
    await settle();

    await load([{ ...summaries[0] }, { ...summaries[1] }], ['t1']);
    expect(text()).toContain('Freitagsrunde');
  });
});
