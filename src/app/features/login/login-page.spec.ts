import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, LoginError } from '../../core/auth/auth.service';
import { loadConfig } from '../../testing/config';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let login: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    login = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { login } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
  });

  const element = () => fixture.nativeElement as HTMLElement;

  async function fill(username: string, password: string): Promise<void> {
    const [user, pass] = Array.from(element().querySelectorAll('input'));
    user.value = username;
    user.dispatchEvent(new Event('input'));
    pass.value = password;
    pass.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('sperrt die Anmeldung, solange Angaben fehlen', () => {
    expect(element().querySelector<HTMLButtonElement>('button[type=submit]')!.disabled).toBe(true);
  });

  it('meldet an und geht zur Turnierliste', async () => {
    login.mockResolvedValue(undefined);
    await fill(' anna ', 'anna');

    await submit();

    expect(login).toHaveBeenCalledWith('anna', 'anna');
    expect(navigate).toHaveBeenCalledWith('/turniere');
  });

  it('kehrt zur gewünschten Seite zurück', async () => {
    login.mockResolvedValue(undefined);
    fixture.componentRef.setInput('weiter', '/turniere/42');
    await fill('anna', 'anna');

    await submit();

    expect(navigate).toHaveBeenCalledWith('/turniere/42');
  });

  it.each(['https://evil.example', '//evil.example', 'turniere'])('ignoriert das fremde Ziel %s', async (target) => {
    login.mockResolvedValue(undefined);
    fixture.componentRef.setInput('weiter', target);
    await fill('anna', 'anna');

    await submit();

    expect(navigate).toHaveBeenCalledWith('/turniere');
  });

  it('zeigt die Fehlermeldung und bleibt auf der Seite', async () => {
    login.mockRejectedValue(new LoginError('Benutzername oder Passwort stimmt nicht.'));
    await fill('anna', 'falsch');

    await submit();

    expect(element().querySelector('[role=alert]')?.textContent).toContain('Benutzername oder Passwort stimmt nicht.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('zeigt im Entwicklungsmodus das Formular mit dem Hinweis auf die Testnutzer', () => {
    expect(element().querySelector('form')).not.toBeNull();
    expect(element().textContent).toContain('Entwicklungsmodus');
  });
});

describe('LoginPage mit OIDC-Provider', () => {
  let startLogin: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    startLogin = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { startLogin } }],
    }).compileComponents();
    await loadConfig({ authMode: 'oidc' });
  });

  async function open(inputs: Record<string, unknown> = {}): Promise<{ fixture: ComponentFixture<LoginPage>; page: HTMLElement }> {
    const fixture = TestBed.createComponent(LoginPage);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  it('leitet ohne Eingabe zum Provider und gibt die gewünschte Seite mit', async () => {
    const { page } = await open({ weiter: '/turniere/42' });

    expect(startLogin).toHaveBeenCalledWith('/turniere/42');
    expect(page.querySelector('form')).toBeNull();
    expect(page.textContent).toContain('Du wirst zur Anmeldung weitergeleitet');
    expect(page.textContent).not.toContain('Entwicklungsmodus');
  });

  it.each(['https://evil.example', '//evil.example', 'turniere'])('gibt das fremde Ziel %s nicht an den Provider', async (target) => {
    await open({ weiter: target });

    expect(startLogin).toHaveBeenCalledWith('/turniere');
  });

  it('leitet kurz nach einer Weiterleitung nicht noch einmal automatisch, sondern bietet die Anmeldung an', async () => {
    await open();
    expect(startLogin).toHaveBeenCalledTimes(1);

    const { fixture, page } = await open();

    expect(startLogin).toHaveBeenCalledTimes(1);
    expect(page.querySelector('[role=alert]')?.textContent).toContain('Die Anmeldung hat nicht geklappt');

    page.querySelector('button')!.click();
    await fixture.whenStable();
    expect(startLogin).toHaveBeenCalledTimes(2);
  });

  it('leitet nach dem Abmelden nicht von selbst wieder weiter', async () => {
    const { fixture, page } = await open({ abgemeldet: true });

    expect(startLogin).not.toHaveBeenCalled();
    expect(page.textContent).toContain('Du bist abgemeldet.');

    page.querySelector('button')!.click();
    await fixture.whenStable();
    expect(startLogin).toHaveBeenCalledTimes(1);
  });

  it('zeigt eine Meldung und lässt es erneut versuchen, wenn der Provider nicht erreichbar ist', async () => {
    startLogin.mockRejectedValue(new Error('Netz weg'));

    const { page } = await open();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('Der Anmeldeserver ist nicht erreichbar.');
    expect(page.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
  });

  it('zeigt die genaue Meldung des Dienstes, etwa dass HTTPS nötig ist', async () => {
    startLogin.mockRejectedValue(new LoginError('Die Anmeldung braucht eine sichere Verbindung (HTTPS oder localhost).'));

    const { page } = await open();

    expect(page.querySelector('[role=alert]')?.textContent).toContain('braucht eine sichere Verbindung');
  });
});
