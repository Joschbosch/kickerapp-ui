import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import {
  ApplicationConfig,
  Injector,
  LOCALE_ID,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { AppConfigService } from './core/app-config';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'de' },
    provideAppInitializer(async () => {
      // Symbole kommen aus dem lokal eingebundenen Material Symbols, nicht von einem fremden Server
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
      const injector = inject(Injector);
      await inject(AppConfigService).load();
      // Erst nach der Konfiguration: Sie entscheidet, wie angemeldet wird. Stellt eine vorhandene Sitzung wieder her.
      await injector.get(AuthService).restore();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
