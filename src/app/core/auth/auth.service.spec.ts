import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Me } from '../../api/models';
import { AuthService, LoginError } from './auth.service';

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

    auth.logout();

    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.me()).toBeNull();
    expect(sessionStorage.getItem('kickertool.token')).toBeNull();
  });
});
