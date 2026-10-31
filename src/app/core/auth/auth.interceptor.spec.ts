import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('kickertool.token', 'abc');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => controller.verify());

  it('hängt das Token an Aufrufe des Backends', () => {
    http.get('http://localhost:8080/api/tournaments').subscribe();

    const request = controller.expectOne('http://localhost:8080/api/tournaments');
    expect(request.request.headers.get('Authorization')).toBe('Bearer abc');
    request.flush([]);
  });

  it('schickt das Token nicht an fremde Adressen', () => {
    http.get('https://example.org/data').subscribe();

    const request = controller.expectOne('https://example.org/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('meldet bei 401 ab und wechselt zur Anmeldung', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);
    http.get('http://localhost:8080/api/tournaments').subscribe({ error: () => undefined });

    controller
      .expectOne('http://localhost:8080/api/tournaments')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isLoggedIn()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('lässt andere Fehler stehen, ohne abzumelden', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);
    http.get('http://localhost:8080/api/tournaments/x').subscribe({ error: () => undefined });

    controller
      .expectOne('http://localhost:8080/api/tournaments/x')
      .flush({}, { status: 404, statusText: 'Not Found' });

    expect(auth.isLoggedIn()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('wertet ein 401 der Anmeldung selbst nicht als abgelaufene Sitzung', () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.post('http://localhost:8080/mock-oidc/token', '').subscribe({ error: () => undefined });

    controller
      .expectOne('http://localhost:8080/mock-oidc/token')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
