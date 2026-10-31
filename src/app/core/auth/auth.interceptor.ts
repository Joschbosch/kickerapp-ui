import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AppConfigService } from '../app-config';
import { AuthService } from './auth.service';

/**
 * Hängt das Token an alle Aufrufe des Backends. Antwortet das Backend mit 401, ist die Sitzung abgelaufen: Dann wird
 * abgemeldet und zur Anmeldung gewechselt.
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
      const isTokenRequest = request.url.endsWith('/mock-oidc/token');
      if (toBackend && !isTokenRequest && error instanceof HttpErrorResponse && error.status === 401) {
        auth.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
