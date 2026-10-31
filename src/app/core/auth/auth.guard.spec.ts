import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { adminGuard, authGuard } from './auth.guard';

describe('Guards', () => {
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => controller.verify());

  function run(guard: CanActivateFn, url: string): Promise<boolean | UrlTree> {
    const state = { url } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, state)) as Promise<boolean | UrlTree>;
  }

  describe('authGuard', () => {
    it('schickt Abgemeldete zur Anmeldung und merkt sich das Ziel', async () => {
      const result = await run(authGuard, '/turniere/42');

      expect(router.serializeUrl(result as UrlTree)).toBe('/login?weiter=%2Fturniere%2F42');
    });

    it('lässt Angemeldete durch, sobald das Profil geladen ist', async () => {
      sessionStorage.setItem('kickertool.token', 'abc');
      const result = run(authGuard, '/turniere');
      await Promise.resolve();
      controller.expectOne('http://localhost:8080/api/me').flush({ id: 'p1', displayName: 'Anna', admin: false });

      expect(await result).toBe(true);
    });

    it('schickt zur Anmeldung, wenn das gespeicherte Token nicht mehr gilt', async () => {
      sessionStorage.setItem('kickertool.token', 'abgelaufen');
      const result = run(authGuard, '/turniere');
      await Promise.resolve();
      controller.expectOne('http://localhost:8080/api/me').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(router.serializeUrl((await result) as UrlTree)).toBe('/login?weiter=%2Fturniere');
    });
  });

  describe('adminGuard', () => {
    it('lässt Admins durch', async () => {
      sessionStorage.setItem('kickertool.token', 'abc');
      const result = run(adminGuard, '/admin');
      await Promise.resolve();
      controller.expectOne('http://localhost:8080/api/me').flush({ id: 'a', displayName: 'Admin', admin: true });

      expect(await result).toBe(true);
    });

    it('schickt normale Spieler zur Turnierliste', async () => {
      sessionStorage.setItem('kickertool.token', 'abc');
      const result = run(adminGuard, '/admin');
      await Promise.resolve();
      controller.expectOne('http://localhost:8080/api/me').flush({ id: 'p1', displayName: 'Anna', admin: false });

      expect(router.serializeUrl((await result) as UrlTree)).toBe('/turniere');
    });
  });
});
