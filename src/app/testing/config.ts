import { TestBed } from '@angular/core/testing';

import { AppConfig, AppConfigService } from '../core/app-config';

/**
 * Lädt eine Konfiguration wie beim Start der App. Nach `TestBed.configureTestingModule(...)` und vor dem ersten Zugriff auf
 * Dienste aufrufen, die den Modus beim Erzeugen lesen (z. B. `AuthService`).
 */
export async function loadConfig(config: Partial<Omit<AppConfig, 'oidc'>> & { oidc?: Partial<AppConfig['oidc']> }): Promise<void> {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => config }));
  try {
    await TestBed.inject(AppConfigService).load();
  } finally {
    vi.unstubAllGlobals();
  }
}
