import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService, LoginError } from '../../core/auth/auth.service';
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
});
