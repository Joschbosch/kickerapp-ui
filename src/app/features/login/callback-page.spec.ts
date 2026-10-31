import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, LoginError } from '../../core/auth/auth.service';
import { markAutoLogin, recentAutoLogin } from '../../core/auth/safe-target';
import { CallbackPage } from './callback-page';

describe('CallbackPage', () => {
  let completeLogin: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;
  let fixture: ComponentFixture<CallbackPage>;

  beforeEach(async () => {
    sessionStorage.clear();
    completeLogin = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CallbackPage],
      providers: [provideRouter([]), { provide: AuthService, useValue: { completeLogin } }],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  async function open(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CallbackPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('geht nach der Anmeldung zur gewünschten Seite, ohne die Rückkehradresse im Verlauf zu lassen', async () => {
    completeLogin.mockResolvedValue('/turniere/42');

    await open();

    expect(navigate).toHaveBeenCalledWith('/turniere/42', { replaceUrl: true });
  });

  it.each(['https://evil.example', '//evil.example', '/'])('ignoriert das Ziel %s und geht zur Turnierliste', async (target) => {
    completeLogin.mockResolvedValue(target === '/' ? 'turniere' : target);

    await open();

    expect(navigate).toHaveBeenCalledWith('/turniere', { replaceUrl: true });
  });

  it('hebt den Schutz vor Weiterleitungsschleifen nach erfolgreicher Anmeldung auf', async () => {
    markAutoLogin();
    completeLogin.mockResolvedValue('/turniere');

    await open();

    expect(recentAutoLogin()).toBe(false);
  });

  it('zeigt bei einem Fehler die Meldung und bietet an, es noch einmal zu versuchen', async () => {
    markAutoLogin();
    completeLogin.mockRejectedValue(new LoginError('Das Backend hat die Anmeldung nicht angenommen.'));

    const page = await open();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('Das Backend hat die Anmeldung nicht angenommen.');
    expect(page.querySelector('a')!.getAttribute('href')).toBe('/login');
    expect(navigate).not.toHaveBeenCalled();
    // Der Schutz bleibt, sonst pendelt die Seite zwischen App und Provider
    expect(recentAutoLogin()).toBe(true);
  });

  it('zeigt bei einem unbekannten Fehler eine allgemeine Meldung', async () => {
    completeLogin.mockRejectedValue(new Error('irgendwas'));

    const page = await open();

    expect(page.textContent).toContain('Die Anmeldung ist fehlgeschlagen.');
  });
});
