import { Injectable, signal } from '@angular/core';

/**
 * Einstellungen, die erst beim Start geladen werden (public/config.json). So lässt sich dieselbe Auslieferung in
 * verschiedenen Umgebungen betreiben, ohne neu zu bauen.
 */
export interface AppConfig {
  /** Adresse des Backends, ohne abschließenden Schrägstrich. */
  apiBaseUrl: string;
  /**
   * `password`: Anmeldung mit Benutzername und Passwort am simulierten Login des lokalen Backends (nur Entwicklung).
   * `oidc`: Anmeldung über den OIDC-Provider (noch nicht umgesetzt).
   */
  authMode: 'password' | 'oidc';
}

const DEFAULTS: AppConfig = { apiBaseUrl: 'http://localhost:8080', authMode: 'password' };

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly current = signal<AppConfig>(DEFAULTS);

  readonly config = this.current.asReadonly();

  async load(): Promise<void> {
    const response = await fetch('config.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`config.json konnte nicht geladen werden (HTTP ${response.status})`);
    }
    const loaded = (await response.json()) as Partial<AppConfig>;
    this.current.set({ ...DEFAULTS, ...loaded, apiBaseUrl: (loaded.apiBaseUrl ?? DEFAULTS.apiBaseUrl).replace(/\/+$/, '') });
  }

  /** Macht aus einem Pfad wie `/api/me` die volle Adresse am Backend. */
  url(path: string): string {
    return `${this.current().apiBaseUrl}${path}`;
  }
}
