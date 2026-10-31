import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TurnCall } from '../../core/alerts/alert-effects';
import { TurnAlerts } from '../../core/alerts/turn-alerts';
import { TurnBanner } from './turn-banner';

const CALL: TurnCall = {
  matchId: 'm1',
  tournamentId: 't1',
  tournamentName: 'Demo-Turnier',
  round: 3,
  table: 2,
  partner: 'Ben Beispiel',
  opponents: ['Clara Beispiel', 'David Beispiel'],
};

describe('TurnBanner', () => {
  let fixture: ComponentFixture<TurnBanner>;
  let calls: ReturnType<typeof signal<TurnCall[]>>;
  let dismiss: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    calls = signal<TurnCall[]>([]);
    dismiss = vi.fn();
    await TestBed.configureTestingModule({
      imports: [TurnBanner],
      providers: [provideRouter([{ path: '**', children: [] }]), { provide: TurnAlerts, useValue: { calls, dismiss } }],
    }).compileComponents();
    fixture = TestBed.createComponent(TurnBanner);
    await fixture.whenStable();
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ').trim();

  it('zeigt nichts, solange niemand dran ist', () => {
    expect(element().querySelector('[role="alert"]')).toBeNull();
    expect(text()).toBe('');
  });

  it('sagt, dass der Spieler dran ist, mit Tisch, Partner und Gegnern', async () => {
    calls.set([CALL]);
    await fixture.whenStable();

    expect(text()).toContain('Du bist dran – Tisch 2');
    expect(text()).toContain('Mit Ben Beispiel gegen Clara Beispiel und David Beispiel');
    expect(text()).toContain('Demo-Turnier · Runde 3');
    expect(element().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('führt mit „Zum Spiel“ zur Turnierseite', async () => {
    calls.set([CALL]);
    await fixture.whenStable();

    expect(element().querySelector('a')!.getAttribute('href')).toBe('/turniere/t1');
  });

  it('zeigt den Link nicht, wenn der Spieler schon auf der Seite dieses Turniers ist, und wieder, wenn er sie verlässt', async () => {
    calls.set([CALL]);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/turniere/t1?x=1');
    await fixture.whenStable();
    expect(element().querySelector('a')).toBeNull();
    expect(text()).toContain('Verstanden');

    await router.navigateByUrl('/turniere');
    await fixture.whenStable();
    expect(element().querySelector('a')!.getAttribute('href')).toBe('/turniere/t1');
  });

  it('zeigt den Link auf der Seite eines anderen Turniers', async () => {
    calls.set([CALL]);

    await TestBed.inject(Router).navigateByUrl('/turniere/t2');
    await fixture.whenStable();

    expect(element().querySelector('a')!.getAttribute('href')).toBe('/turniere/t1');
  });

  it('blendet den Hinweis mit „Verstanden“ aus', async () => {
    calls.set([CALL]);
    await fixture.whenStable();

    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.includes('Verstanden'))!.click();

    expect(dismiss).toHaveBeenCalledWith('m1');
  });

  it('zeigt mehrere Hinweise untereinander, etwa aus zwei Turnieren', async () => {
    calls.set([CALL, { ...CALL, matchId: 'm2', tournamentId: 't2', tournamentName: 'Freitagsrunde', table: 5 }]);
    await fixture.whenStable();

    expect(element().querySelectorAll('section').length).toBe(2);
    expect(text()).toContain('Tisch 5');
    expect(text()).toContain('Freitagsrunde');
  });

  it('verschwindet, wenn der Spieler nicht mehr dran ist', async () => {
    calls.set([CALL]);
    await fixture.whenStable();

    calls.set([]);
    await fixture.whenStable();

    expect(element().querySelector('section')).toBeNull();
  });
});
