import { Injectable, signal } from '@angular/core';

/** Der OIDC-Provider (Keycloak), nur im Modus `oidc` gebraucht. */
export interface OidcConfig {
  /** Adresse des Realms, z. B. `http://localhost:8180/realms/kickertool`. Muss zum Aussteller (`iss`) der Tokens passen. */
  authority: string;
  /** Öffentlicher Client ohne Secret. */
  clientId: string;
}

/**
 * Einstellungen, die erst beim Start geladen werden (public/config.json). So lässt sich dieselbe Auslieferung in
 * verschiedenen Umgebungen betreiben, ohne neu zu bauen.
 */
export interface AppConfig {
  /** Adresse des Backends, ohne abschließenden Schrägstrich. */
  apiBaseUrl: string;
  /**
   * `password`: Anmeldung mit Benutzername und Passwort am simulierten Login des lokalen Backends (nur Entwicklung).
   * `oidc`: Anmeldung über den OIDC-Provider (Authorization Code mit PKCE, Token-Erneuerung per Refresh-Token).
   */
  authMode: 'password' | 'oidc';
  oidc: OidcConfig;
}

const DEFAULTS: AppConfig = {
  apiBaseUrl: 'http://localhost:8080',
  authMode: 'password',
  oidc: { authority: 'http://localhost:8180/realms/kickertool', clientId: 'kickertool-app' },
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly current = signal<AppConfig>(DEFAULTS);

  readonly config = this.current.asReadonly();

  async load(): Promise<void> {
    const response = await fetch('config.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`config.json konnte nicht geladen werden (HTTP ${response.status})`);
    }
    const loaded = (await response.json()) as Partial<Omit<AppConfig, 'oidc'>> & { oidc?: Partial<OidcConfig> };
    this.current.set({
      ...DEFAULTS,
      ...loaded,
      apiBaseUrl: (loaded.apiBaseUrl ?? DEFAULTS.apiBaseUrl).replace(/\/+$/, ''),
      oidc: { ...DEFAULTS.oidc, ...loaded.oidc },
    });
  }

  /** Macht aus einem Pfad wie `/api/me` die volle Adresse am Backend. */
  url(path: string): string {
    return `${this.current().apiBaseUrl}${path}`;
  }
}
