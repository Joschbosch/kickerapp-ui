import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Me } from '../../api/models';
import { AppConfigService } from '../app-config';
import { OIDC_SESSION, OidcSession } from './oidc-session';

const TOKEN_KEY = 'kickertool.token';

interface TokenResponse {
  access_token: string;
}

/** Anmeldung ist fehlgeschlagen, `message` ist für den Nutzer gedacht. */
export class LoginError extends Error {}

/**
 * Hält Token und Profil des angemeldeten Spielers.
 *
 * Zwei Arten der Anmeldung, je nach `authMode` in der Konfiguration:
 * - `password`: Benutzername und Passwort am simulierten Login des lokalen Backends (nur Entwicklung). Das Token liegt
 *   im `sessionStorage`.
 * - `oidc`: Authorization Code mit PKCE am OIDC-Provider (Keycloak). Die Sitzung und die Erneuerung des Tokens
 *   (Refresh-Token) liegen in `OidcSession`, hier steht nur das jeweils gültige Access-Token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  /** Nur im Modus `oidc` vorhanden. */
  private readonly session: OidcSession | null = this.config.config().authMode === 'oidc' ? inject(OIDC_SESSION) : null;

  private readonly tokenValue = signal<string | null>(this.session === null ? readStoredToken() : null);
  private readonly profile = signal<Me | null>(null);

  readonly token = this.tokenValue.asReadonly();
  readonly me = this.profile.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenValue() !== null);
  readonly isAdmin = computed(() => this.profile()?.admin === true);
  /** Läuft die Anmeldung über einen OIDC-Provider? */
  readonly usesProvider = this.session !== null;

  constructor() {
    // Das erneuerte Token ersetzt das alte, ab dann hängt der Interceptor das neue an
    this.session?.watch((token) => {
      this.tokenValue.set(token);
      if (token === null) {
        this.profile.set(null);
      }
    });
  }

  /** Stellt nach dem Start der Seite die Sitzung wieder her. Beim Passwort-Login liegt das Token schon bereit. */
  async restore(): Promise<void> {
    if (this.session !== null) {
      this.tokenValue.set(await this.session.restore());
    }
  }

  /** Meldet mit Benutzername und Passwort an (nur im Modus `password`) und lädt das Profil. */
  async login(username: string, password: string): Promise<void> {
    if (this.session !== null) {
      throw new LoginError('Diese Anmeldeart wird nicht unterstützt.');
    }
    const body = new HttpParams({
      fromObject: { grant_type: 'password', client_id: 'kickertool-app', username, password },
    }).toString();
    try {
      const response = await firstValueFrom(
        this.http.post<TokenResponse>(this.config.url('/mock-oidc/token'), body, {
          headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
        }),
      );
      this.storeToken(response.access_token);
      await this.loadProfile();
    } catch (error) {
      this.clearLocal();
      throw new LoginError(loginMessage(error));
    }
  }

  /** Leitet zum OIDC-Provider weiter. Nach der Anmeldung geht es auf `returnUrl` weiter. */
  async startLogin(returnUrl: string): Promise<void> {
    if (this.session === null) {
      throw new LoginError('Diese Anmeldeart wird nicht unterstützt.');
    }
    try {
      await this.session.signIn(returnUrl);
    } catch {
      // Ohne crypto.subtle (kein HTTPS, nicht localhost) kann der Code-Flow nicht beginnen: Das ist kein Netzproblem
      throw new LoginError(
        typeof crypto !== 'undefined' && crypto.subtle
          ? 'Der Anmeldeserver ist nicht erreichbar.'
          : 'Die Anmeldung braucht eine sichere Verbindung (HTTPS oder localhost).',
      );
    }
  }

  /** Wertet die Rückkehr vom OIDC-Provider aus, lädt das Profil und liefert die Seite, zu der es weitergeht. */
  async completeLogin(): Promise<string> {
    if (this.session === null) {
      throw new LoginError('Diese Anmeldeart wird nicht unterstützt.');
    }
    try {
      const { accessToken, returnUrl } = await this.session.complete();
      this.tokenValue.set(accessToken);
      if ((await this.loadProfile()) === null) {
        throw new LoginError('Das Backend hat die Anmeldung nicht angenommen.');
      }
      return returnUrl;
    } catch (error) {
      this.expire();
      if (error instanceof LoginError) {
        throw error;
      }
      const unreachable = error instanceof HttpErrorResponse && error.status === 0;
      throw new LoginError(unreachable ? 'Das Backend ist nicht erreichbar.' : 'Die Anmeldung ist fehlgeschlagen.');
    }
  }

  /** Lädt das Profil (Name, Admin-Flag) zum Token. Ist das Token ungültig, wird abgemeldet. */
  async loadProfile(): Promise<Me | null> {
    if (this.tokenValue() === null) {
      return null;
    }
    try {
      const me = await firstValueFrom(this.http.get<Me>(this.config.url('/api/me')));
      this.profile.set(me);
      return me;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.expire();
        return null;
      }
      throw error;
    }
  }

  /** Stellt sicher, dass das Profil geladen ist (z. B. nach dem Neuladen der Seite). */
  async ensureProfile(): Promise<Me | null> {
    return this.profile() ?? (await this.loadProfile());
  }

  /**
   * Meldet ab. Mit OIDC-Provider wird auch dort abgemeldet, der Browser verlässt dafür die Seite. Ergebnis: `true`, wenn
   * die App selbst zur Anmeldeseite wechseln soll, `false`, wenn der Browser zum Provider geht.
   */
  async logout(): Promise<boolean> {
    this.clearLocal();
    if (this.session === null) {
      return true;
    }
    try {
      await this.session.signOut();
      return false;
    } catch {
      // Der Provider ist nicht erreichbar: wenigstens lokal vergessen
      await this.session.clear().catch(() => undefined);
      return true;
    }
  }

  /** Die Sitzung gilt nicht mehr (Backend meldet 401): lokal vergessen, ohne den Provider abzumelden. */
  expire(): void {
    this.clearLocal();
    void this.session?.clear().catch(() => undefined);
  }

  private storeToken(token: string): void {
    this.tokenValue.set(token);
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Speicher gesperrt (z. B. privater Modus): das Token gilt dann nur bis zum Neuladen
    }
  }

  private clearLocal(): void {
    this.tokenValue.set(null);
    this.profile.set(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // nichts zu tun
    }
  }
}

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function loginMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 400) {
      return 'Benutzername oder Passwort stimmt nicht.';
    }
    if (error.status === 0) {
      return 'Das Backend ist nicht erreichbar.';
    }
  }
  return 'Die Anmeldung ist fehlgeschlagen.';
}
