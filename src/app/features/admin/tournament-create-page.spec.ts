import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { fieldByLabel } from '../../testing/dom';
import { tournament } from '../../testing/fixtures';
import { TournamentCreatePage, today } from './tournament-create-page';

const URL = 'http://localhost:8080/api/tournaments';

describe('TournamentCreatePage', () => {
  let fixture: ComponentFixture<TournamentCreatePage>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TournamentCreatePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TournamentCreatePage);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const element = () => fixture.nativeElement as HTMLElement;

  async function fillName(name: string): Promise<void> {
    const input = fieldByLabel(element(), 'Name');
    input.value = name;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  const submit = () => element().querySelector('form')!.dispatchEvent(new Event('submit'));

  it('beginnt mit den Standardwerten des Backends und dem heutigen Datum', () => {
    const value = (label: string) => fieldByLabel(element(), label).value;

    expect(value('Name')).toBe('');
    expect(value('Datum')).toBe(today());
    expect(value('Anzahl Tische')).toBe('1');
    expect(value('Tore pro Match')).toBe('10');
    expect(value('Spielzeit in Minuten')).toBe('5');
    expect(value('Zufallsrunden am Anfang')).toBe('2');
    expect(value('Punkte für einen Sieg')).toBe('3');
    expect(value('Punkte für ein Unentschieden')).toBe('1');
    expect(value('Punkte für eine Niederlage')).toBe('0');
  });

  it('legt das Turnier an und wechselt zu dessen Verwaltung', async () => {
    await fillName('Herbstturnier');

    submit();
    const request = http.expectOne({ method: 'POST', url: URL });
    expect(request.request.body).toEqual({
      name: 'Herbstturnier',
      date: today(),
      config: {
        tableCount: 1,
        goalLimit: 10,
        matchMinutes: 5,
        randomRounds: 2,
        plannedRounds: null,
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
      },
    });
    request.flush(tournament({ id: 't9' }));
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/admin/turniere', 't9']);
  });

  it('legt nichts an, solange der Name fehlt', async () => {
    submit();

    http.expectNone(URL);
    expect(element().querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('zeigt die Meldung des Backends und bleibt auf der Seite', async () => {
    await fillName('Herbstturnier');

    submit();
    http
      .expectOne(URL)
      .flush({ detail: 'Es gibt schon ein Turnier mit diesem Namen.' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(document.body.textContent).toContain('Es gibt schon ein Turnier mit diesem Namen.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('nimmt als heutiges Datum das der Zeitzone des Browsers', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 9, 5, 23, 30));
      expect(today()).toBe('2026-10-05');
    } finally {
      vi.useRealTimers();
    }
  });
});
