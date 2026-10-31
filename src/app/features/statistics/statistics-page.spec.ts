import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PlayerStatistics } from '../../api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ANNA, BEN, standing, statistics } from '../../testing/fixtures';
import { StatisticsPage } from './statistics-page';

const URL = 'http://localhost:8080/api/players';

describe('StatisticsPage', () => {
  let fixture: ComponentFixture<StatisticsPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatisticsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { me: signal({ id: ANNA.id, displayName: ANNA.displayName, admin: false }) } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatisticsPage);
  });

  afterEach(() => http.verify());

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ');

  /** Die Kacheln der Gesamtwerte: Überschrift und die Texte darunter. */
  const tiles = () =>
    Object.fromEntries(
      Array.from(element().querySelectorAll('dl > div')).map((tile) => [
        tile.querySelector('dt')!.textContent!.trim(),
        Array.from(tile.querySelectorAll('dd')).map((entry) => entry.textContent!.trim()),
      ]),
    );

  /** Öffnet die Seite (mit der ID aus der Adresse, falls angegeben) und beantwortet die Anfrage. */
  async function open(path: string, body: PlayerStatistics, id?: string): Promise<void> {
    if (id !== undefined) {
      fixture.componentRef.setInput('id', id);
    }
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${URL}/${path}/statistics`).flush(body);
    await fixture.whenStable();
  }

  it('zeigt ohne Angabe in der Adresse die eigene Statistik', async () => {
    await open(
      'me',
      statistics(ANNA, [standing({ name: 'Frühjahr' }), standing({ tournamentId: 't2', name: 'Herbst', tournamentStatus: 'RUNNING', rank: 3, points: 4 })], {
        titles: 1,
        podiums: 2,
      }),
    );

    expect(text()).toContain('Meine Statistik');
    expect(tiles()).toEqual({
      Turniere: ['2', '1 beendet'],
      Spiele: ['8', '6 S · 0 U · 2 N'],
      Tore: ['76:48', 'Differenz +28'],
      Punkte: ['13'],
      Titel: ['1', '2 × auf dem Podest'],
    });
  });

  it('listet die Turniere mit Platz, Status und Zahlen und verlinkt sie', async () => {
    await open(
      'me',
      statistics(ANNA, [
        standing({ tournamentId: 't2', name: 'Herbst', tournamentStatus: 'RUNNING', rank: 3, participantCount: 10, points: 4, goalDifference: -2 }),
        standing({ tournamentId: 't1', name: 'Frühjahr' }),
      ]),
    );

    const entries = Array.from(element().querySelectorAll('a.tournament'));
    expect(entries.map((entry) => entry.getAttribute('href'))).toEqual(['/turniere/t2', '/turniere/t1']);
    const first = entries[0].textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('Herbst');
    expect(first).toContain('Läuft');
    expect(first).toContain('Platz 3 von 10');
    expect(first).toContain('4 Punkte · 4 Spiele · Tore 38:24 (-2)');
    expect(entries[1].textContent).toContain('Beendet');
    expect(entries[1].textContent).toContain('Platz 1 von 8');
  });

  it('zeigt, wenn ein Spieler pausiert oder ausgeschieden ist', async () => {
    await open('me', statistics(ANNA, [standing({ participantStatus: 'WITHDRAWN' })]));

    expect(text()).toContain('Ausgeschieden');
  });

  it('zeigt die Statistik eines anderen Spielers mit dessen Namen', async () => {
    await open(BEN.id, statistics(BEN, [standing()]), BEN.id);

    expect(text()).toContain('Statistik von Ben Beispiel');
    expect(text()).not.toContain('Meine Statistik');
  });

  it('erkennt die eigene Statistik auch, wenn die eigene ID in der Adresse steht', async () => {
    await open(ANNA.id, statistics(ANNA, [standing()]), ANNA.id);

    expect(text()).toContain('Meine Statistik');
  });

  it('sagt, wenn der Spieler noch an keinem Turnier teilgenommen hat', async () => {
    await open('me', statistics(ANNA, []));

    expect(text()).toContain('Du hast noch an keinem Turnier teilgenommen.');
    expect(element().querySelector('dl')).toBeNull();
  });

  it('sagt das auch für einen anderen Spieler', async () => {
    await open(BEN.id, statistics(BEN, []), BEN.id);

    expect(text()).toContain('Ben Beispiel hat noch an keinem Turnier teilgenommen.');
  });

  it('bietet bei einem Fehler an, es erneut zu versuchen', async () => {
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${URL}/me/statistics`).flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(text()).toContain('Die Statistik konnte nicht geladen werden.');

    element().querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${URL}/me/statistics`).flush(statistics(ANNA, [standing()]));
    await fixture.whenStable();

    expect(text()).toContain('Meine Statistik');
  });

  it('meldet einen unbekannten Spieler als Fehler', async () => {
    fixture.componentRef.setInput('id', 'gibt-es-nicht');
    fixture.detectChanges();
    await Promise.resolve();
    http.expectOne(`${URL}/gibt-es-nicht/statistics`).flush({}, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(element().querySelector('[role=alert]')).not.toBeNull();
  });
});
