import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AppConfigService } from '../app-config';
import { AuthService } from './auth.service';

/**
 * Hängt das aktuelle Token an alle Aufrufe des Backends (nach einer Erneuerung das neue). Antwortet das Backend mit 401,
 * ist die Sitzung abgelaufen: Dann wird lokal vergessen und zur Anmeldung gewechselt. Mit OIDC-Provider führt die
 * Anmeldeseite von dort meist ohne Eingabe zurück, solange die Sitzung beim Provider noch läuft.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const config = inject(AppConfigService);
  const router = inject(Router);

  const toBackend = request.url.startsWith(config.config().apiBaseUrl);
  const token = auth.token();
  const authorized =
    toBackend && token !== null ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      // Die Anmeldung selbst und das Laden des Profils (Guard, Rückkehr vom Provider) behandelt `AuthService`: Ein
      // zweiter Wechsel zur Anmeldung hier würde den des Guards mit der Rückkehr-Adresse überholen.
      const handledByAuth = request.url.endsWith('/mock-oidc/token') || request.url.endsWith('/api/me');
      if (toBackend && !handledByAuth && error instanceof HttpErrorResponse && error.status === 401) {
        auth.expire();
        // Nach der erneuten Anmeldung zurück auf die Seite, auf der die Sitzung ablief (z. B. die Anzeige am Beamer)
        const here = router.url;
        const resume = here === '/' || /^\/(login|auth\/|abgemeldet)/.test(here) ? undefined : here;
        void router.navigate(['/login'], resume ? { queryParams: { weiter: resume } } : {});
      }
      return throwError(() => error);
    }),
  );
};
