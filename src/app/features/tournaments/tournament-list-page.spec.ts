import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TournamentSummary } from '../../api/models';
import { TournamentListPage } from './tournament-list-page';

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
