import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Me } from '../../api/models';
import { AppConfigService } from '../app-config';

const TOKEN_KEY = 'kickertool.token';

interface TokenResponse {
  access_token: string;
}

/** Anmeldung ist fehlgeschlagen, `message` ist für den Nutzer gedacht. */
export class LoginError extends Error {}

/**
 * Hält Token und Profil des angemeldeten Spielers.
 *
 * Aktuell gibt es nur die Anmeldung mit Benutzername und Passwort am simulierten Login des lokalen Backends
 * (`authMode: password`). Die Anmeldung über den OIDC-Provider kommt später hinter derselben Schnittstelle dazu.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private readonly tokenValue = signal<string | null>(readStoredToken());
  private readonly profile = signal<Me | null>(null);

  readonly token = this.tokenValue.asReadonly();
  readonly me = this.profile.asReadonly();
  readonly isLoggedIn = computed(() => this.tokenValue() !== null);
  readonly isAdmin = computed(() => this.profile()?.admin === true);

  /** Meldet mit Benutzername und Passwort an (nur im Modus `password`) und lädt das Profil. */
  async login(username: string, password: string): Promise<void> {
    if (this.config.config().authMode !== 'password') {
      throw new LoginError('Diese Anmeldeart wird noch nicht unterstützt.');
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
      this.clear();
      throw new LoginError(loginMessage(error));
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
        this.clear();
        return null;
      }
      throw error;
    }
  }

  /** Stellt sicher, dass das Profil geladen ist (z. B. nach dem Neuladen der Seite). */
  async ensureProfile(): Promise<Me | null> {
    return this.profile() ?? (await this.loadProfile());
  }

  logout(): void {
    this.clear();
  }

  private storeToken(token: string): void {
    this.tokenValue.set(token);
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Speicher gesperrt (z. B. privater Modus): das Token gilt dann nur bis zum Neuladen
    }
  }

  private clear(): void {
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
