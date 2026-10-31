import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Me } from '../../api/models';
import { loadConfig } from '../../testing/config';
import { fakeOidcSession } from '../../testing/oidc';
import { AuthService, LoginError } from './auth.service';
import { OIDC_SESSION } from './oidc-session';

const ME: Me = { id: 'p1', displayName: 'Anna Beispiel', admin: false } as Me;

describe('AuthService', () => {
  let http: HttpTestingController;

  function create(): AuthService {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => sessionStorage.clear());

  afterEach(() => http.verify());

  it('holt mit Benutzername und Passwort ein Token und lädt danach das Profil', async () => {
    const auth = create();

    const login = auth.login('anna', 'geheim');
    const tokenRequest = http.expectOne('http://localhost:8080/mock-oidc/token');
    expect(tokenRequest.request.method).toBe('POST');
    expect(tokenRequest.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    const form = new URLSearchParams(tokenRequest.request.body as string);
    expect(form.get('grant_type')).toBe('password');
    expect(form.get('username')).toBe('anna');
    expect(form.get('password')).toBe('geheim');
    tokenRequest.flush({ access_token: 'abc' });
    await Promise.resolve();
    http.expectOne('http://localhost:8080/api/me').flush(ME);
    await login;

    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.token()).toBe('abc');
    expect(auth.me()?.displayName).toBe('Anna Beispiel');
    expect(auth.isAdmin()).toBe(false);
    expect(sessionStorage.getItem('kickertool.token')).toBe('abc');
  });

  it('meldet bei falschem Passwort mit verständlicher Meldung ab', async () => {
    const auth = create();

    const login = auth.login('anna', 'falsch');
    http.expectOne('http://localhost:8080/mock-oidc/token').flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(login).rejects.toThrow(new LoginError('Benutzername oder Passwort stimmt nicht.'));
    expect(auth.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('kickertool.token')).toBeNull();
  });

  it('meldet, wenn das Backend nicht erreichbar ist', async () => {
    const auth = create();

    const login = auth.login('anna', 'anna');
    http.expectOne('http://localhost:8080/mock-oidc/token').error(new ProgressEvent('error'));

    await expect(login).rejects.toThrow('Das Backend ist nicht erreichbar.');
  });

  it('übernimmt ein gespeichertes Token und lädt das Profil bei Bedarf', async () => {
    sessionStorage.setItem('kickertool.token', 'gespeichert');
    const auth = create();
    expect(auth.isLoggedIn()).toBe(true);

    const profile = auth.ensureProfile();
    http.expectOne('http://localhost:8080/api/me').flush({ ...ME, admin: true });

    expect((await profile)?.admin).toBe(true);
    expect(auth.isAdmin()).toBe(true);
    // ein zweiter Aufruf fragt das Backend nicht erneut
    expect(await auth.ensureProfile()).not.toBeNull();
  });

  it('wirft ein ungültiges gespeichertes Token weg', async () => {
    sessionStorage.setItem('kickertool.token', 'abgelaufen');
    const auth = create();

    const profile = auth.loadProfile();
    http.expectOne('http://localhost:8080/api/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(await profile).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('kickertool.token')).toBeNull();
  });

  it('vergisst beim Abmelden Token und Profil', async () => {
    sessionStorage.setItem('kickertool.token', 'abc');
    const auth = create();
    const profile = auth.loadProfile();
    http.expectOne('http://localhost:8080/api/me').flush(ME);
    await profile;

    expect(await auth.logout()).toBe(true);

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.me()).toBeNull();
    expect(sessionStorage.getItem('kickertool.token')).toBeNull();
  });

  it('kennt ohne OIDC-Provider keine Weiterleitung', async () => {
    const auth = create();

    expect(auth.usesProvider).toBe(false);
    await expect(auth.startLogin('/turniere')).rejects.toBeInstanceOf(LoginError);
    await expect(auth.completeLogin()).rejects.toBeInstanceOf(LoginError);
  });
});

describe('AuthService mit OIDC-Provider', () => {
  let http: HttpTestingController;
  let fake: ReturnType<typeof fakeOidcSession>;

  async function create(): Promise<AuthService> {
    fake = fakeOidcSession();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: OIDC_SESSION, useValue: fake.session }],
    });
    http = TestBed.inject(HttpTestingController);
    await loadConfig({ authMode: 'oidc' });
    return TestBed.inject(AuthService);
  }

  beforeEach(() => sessionStorage.clear());

  afterEach(() => http.verify());

  it('stellt die Sitzung nach dem Neuladen wieder her, ohne das Token selbst zu speichern', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('aus-der-sitzung');

    await auth.restore();

    expect(auth.usesProvider).toBe(true);
    expect(auth.token()).toBe('aus-der-sitzung');
    expect(auth.isLoggedIn()).toBe(true);
    expect(sessionStorage.getItem('kickertool.token')).toBeNull();
  });

  it('ist ohne gespeicherte Sitzung abgemeldet und ignoriert ein Token des Passwort-Logins', async () => {
    sessionStorage.setItem('kickertool.token', 'altes-passwort-token');
    const auth = await create();

    await auth.restore();

    expect(auth.isLoggedIn()).toBe(false);
  });

  it('übernimmt jedes erneuerte Token', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('token-1');
    await auth.restore();

    fake.renew('token-2');

    expect(auth.token()).toBe('token-2');
  });

  it('meldet ab und vergisst das Profil, wenn die Sitzung nicht mehr zu retten ist', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('token-1');
    await auth.restore();
    const profile = auth.loadProfile();
    http.expectOne('http://localhost:8080/api/me').flush(ME);
    await profile;

    fake.renew(null);

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.me()).toBeNull();
  });

  it('leitet zum Provider und gibt die Zielseite mit', async () => {
    const auth = await create();

    await auth.startLogin('/turniere/42');

    expect(fake.session.signIn).toHaveBeenCalledWith('/turniere/42');
  });

  it('schließt die Anmeldung nach der Rückkehr ab: Token, Profil, Zielseite', async () => {
    const auth = await create();
    fake.session.complete.mockResolvedValue({ accessToken: 'neu', returnUrl: '/turniere/42' });

    const target = auth.completeLogin();
    await vi.waitFor(() => http.expectOne('http://localhost:8080/api/me').flush({ ...ME, admin: true }));

    expect(await target).toBe('/turniere/42');
    expect(auth.token()).toBe('neu');
    expect(auth.isAdmin()).toBe(true);
  });

  it('meldet eine fehlgeschlagene Rückkehr vom Provider und bleibt abgemeldet', async () => {
    const auth = await create();
    fake.session.complete.mockRejectedValue(new Error('access_denied'));

    await expect(auth.completeLogin()).rejects.toThrow(new LoginError('Die Anmeldung ist fehlgeschlagen.'));

    expect(auth.isLoggedIn()).toBe(false);
    expect(fake.session.clear).toHaveBeenCalled();
  });

  it('meldet, wenn das Backend das Token des Providers ablehnt', async () => {
    const auth = await create();
    fake.session.complete.mockResolvedValue({ accessToken: 'abgelehnt', returnUrl: '/turniere' });

    const target = auth.completeLogin();
    target.catch(() => undefined);
    await vi.waitFor(() =>
      http.expectOne('http://localhost:8080/api/me').flush({}, { status: 401, statusText: 'Unauthorized' }),
    );

    await expect(target).rejects.toThrow(new LoginError('Das Backend hat die Anmeldung nicht angenommen.'));
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('meldet, wenn das Backend nach der Rückkehr nicht erreichbar ist', async () => {
    const auth = await create();
    fake.session.complete.mockResolvedValue({ accessToken: 'neu', returnUrl: '/turniere' });

    const target = auth.completeLogin();
    target.catch(() => undefined);
    await vi.waitFor(() => http.expectOne('http://localhost:8080/api/me').error(new ProgressEvent('error')));

    await expect(target).rejects.toThrow(new LoginError('Das Backend ist nicht erreichbar.'));
  });

  it('kennt kein Formular mit Benutzername und Passwort', async () => {
    const auth = await create();

    await expect(auth.login('anna', 'anna')).rejects.toBeInstanceOf(LoginError);
  });

  it('meldet beim Abmelden auch am Provider ab und lässt den Browser dorthin wechseln', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('token-1');
    await auth.restore();

    const navigateHere = await auth.logout();

    expect(navigateHere).toBe(false);
    expect(fake.session.signOut).toHaveBeenCalled();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('vergisst die Sitzung lokal, wenn sich der Provider nicht abmelden lässt', async () => {
    const auth = await create();
    fake.session.signOut.mockRejectedValue(new Error('nicht erreichbar'));

    const navigateHere = await auth.logout();

    expect(navigateHere).toBe(true);
    expect(fake.session.clear).toHaveBeenCalled();
  });

  it('vergisst bei einer abgelaufenen Sitzung nur lokal und meldet nicht am Provider ab', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('token-1');
    await auth.restore();

    auth.expire();

    expect(auth.isLoggedIn()).toBe(false);
    expect(fake.session.clear).toHaveBeenCalled();
    expect(fake.session.signOut).not.toHaveBeenCalled();
  });

  it('vergisst die Sitzung, wenn das Backend das Token beim Laden des Profils ablehnt', async () => {
    const auth = await create();
    fake.session.restore.mockResolvedValue('abgelaufen');
    await auth.restore();

    const profile = auth.loadProfile();
    http.expectOne('http://localhost:8080/api/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(await profile).toBeNull();
    expect(fake.session.clear).toHaveBeenCalled();
  });
});
