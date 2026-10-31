import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Nur für Angemeldete. Alle anderen kommen zur Anmeldung und danach zurück zur gewünschten Seite. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/login'], { queryParams: { weiter: state.url } });
  }
  const me = await auth.ensureProfile();
  return me !== null ? true : router.createUrlTree(['/login'], { queryParams: { weiter: state.url } });
};

/** Nur für Admins. Alle anderen landen bei der Turnierliste. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureProfile();
  return auth.isAdmin() ? true : router.createUrlTree(['/turniere']);
};
