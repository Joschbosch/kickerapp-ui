import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { TurnAlerts } from '../../core/alerts/turn-alerts';
import { AuthService } from '../../core/auth/auth.service';
import { Shell } from './shell';

describe('Shell', () => {
  let fixture: ComponentFixture<Shell>;
  let me: ReturnType<typeof signal<{ id: string; displayName: string; admin: boolean } | null>>;
  let alerts: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    calls: ReturnType<typeof signal<never[]>>;
    canAskPermission: ReturnType<typeof signal<boolean>>;
    soundOn: ReturnType<typeof signal<boolean>>;
    setSound: ReturnType<typeof vi.fn>;
    enableSystemNotifications: ReturnType<typeof vi.fn>;
    dismiss: ReturnType<typeof vi.fn>;
  };
  let logout: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    me = signal({ id: 'p1', displayName: 'Anna Beispiel', admin: false });
    logout = vi.fn().mockResolvedValue(true);
    alerts = {
      start: vi.fn(),
      stop: vi.fn(),
      calls: signal([]),
      canAskPermission: signal(true),
      soundOn: signal(true),
      setSound: vi.fn(),
      enableSystemNotifications: vi.fn(),
      dismiss: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), { provide: AuthService, useValue: { me, logout } }, { provide: TurnAlerts, useValue: alerts }],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
  });

  const element = () => fixture.nativeElement as HTMLElement;

  async function openMenu(): Promise<HTMLElement[]> {
    element().querySelector<HTMLButtonElement>('button.user')!.click();
    await fixture.whenStable();
    return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
  const item = (items: HTMLElement[], label: string) => items.find((entry) => entry.textContent!.includes(label))!;

  it('beobachtet für den angemeldeten Nutzer, wann er dran ist', () => {
    expect(alerts.start).toHaveBeenCalled();
  });

  it('hört auf, wenn niemand mehr angemeldet ist', async () => {
    me.set(null);
    await fixture.whenStable();

    expect(alerts.stop).toHaveBeenCalled();
  });

  it('hört auf, wenn die Seite geschlossen wird', () => {
    alerts.stop.mockClear();

    fixture.destroy();

    expect(alerts.stop).toHaveBeenCalled();
  });

  it('bietet im Menü die Systembenachrichtigungen an, solange sie nicht erlaubt sind', async () => {
    const items = await openMenu();

    item(items, 'Benachrichtigungen erlauben').click();

    expect(alerts.enableSystemNotifications).toHaveBeenCalled();
  });

  it('bietet die Erlaubnis nicht mehr an, wenn sie erteilt ist', async () => {
    alerts.canAskPermission.set(false);
    await fixture.whenStable();

    const items = await openMenu();

    expect(items.some((entry) => entry.textContent!.includes('Benachrichtigungen erlauben'))).toBe(false);
  });

  it('schaltet den Ton aus und wieder an', async () => {
    let items = await openMenu();
    expect(item(items, 'Ton').textContent).toContain('ausschalten');

    item(items, 'Ton').click();
    expect(alerts.setSound).toHaveBeenCalledWith(false);

    alerts.soundOn.set(false);
    await fixture.whenStable();
    items = await openMenu();
    expect(item(items, 'Ton').textContent).toContain('einschalten');
  });

  it('meldet ab und wechselt zur Anmeldung, wenn die App selbst dorthin wechselt', async () => {
    const items = await openMenu();

    item(items, 'Abmelden').click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('wechselt beim Abmelden nicht selbst, wenn der Browser zum Provider geht', async () => {
    logout.mockResolvedValue(false);
    const items = await openMenu();

    item(items, 'Abmelden').click();
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
  });
});
