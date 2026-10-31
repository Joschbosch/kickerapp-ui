import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MatchTimer } from './match-timer';

describe('MatchTimer', () => {
  let fixture: ComponentFixture<MatchTimer>;
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
    vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    await TestBed.configureTestingModule({ imports: [MatchTimer] }).compileComponents();
    fixture = TestBed.createComponent(MatchTimer);
    fixture.componentRef.setInput('matchId', 'm1');
    fixture.componentRef.setInput('minutes', 5);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  const element = () => fixture.nativeElement as HTMLElement;
  const text = () => element().textContent!.replace(/\s+/g, ' ').trim();
  const button = (label: string) =>
    Array.from(element().querySelectorAll('button')).find((entry) => entry.textContent!.includes(label))!;

  async function tick(seconds: number): Promise<void> {
    vi.advanceTimersByTime(seconds * 1000);
    await fixture.whenStable();
  }

  it('bietet an, die Spielzeit zu starten, und nennt die Minuten', () => {
    expect(text()).toContain('Spielzeit starten (5 Min.)');
  });

  it('zählt ab dem Start herunter', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();
    expect(text()).toContain('5:00');

    await tick(1);
    expect(text()).toContain('4:59');

    await tick(75);
    expect(text()).toContain('3:44');
  });

  it('meldet, wenn die Zeit um ist, und vibriert genau einmal', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();

    await tick(5 * 60);

    expect(text()).toContain('0:00');
    expect(text()).toContain('Zeit ist um');
    expect(vibrate).toHaveBeenCalledTimes(1);

    await tick(60);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('beginnt mit „Zurücksetzen“ von vorn', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();
    await tick(30);

    button('Zurücksetzen').click();
    await fixture.whenStable();

    expect(text()).toContain('Spielzeit starten (5 Min.)');
    expect(sessionStorage.getItem('kickertool.timer.m1')).toBeNull();
  });

  it('läuft nach dem Neuladen der Seite weiter', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();
    fixture.destroy();

    vi.setSystemTime(new Date(2026, 9, 31, 12, 2, 0));
    const reloaded = TestBed.createComponent(MatchTimer);
    reloaded.componentRef.setInput('matchId', 'm1');
    reloaded.componentRef.setInput('minutes', 5);
    await reloaded.whenStable();

    expect((reloaded.nativeElement as HTMLElement).textContent).toContain('3:00');
  });

  it('hält die Zähler verschiedener Matches auseinander', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();

    fixture.componentRef.setInput('matchId', 'm2');
    await fixture.whenStable();

    expect(text()).toContain('Spielzeit starten');
  });

  it('hört nach dem Schließen auf zu zählen', async () => {
    button('Spielzeit starten').click();
    await fixture.whenStable();

    fixture.destroy();
    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(vibrate).not.toHaveBeenCalled();
  });
});
