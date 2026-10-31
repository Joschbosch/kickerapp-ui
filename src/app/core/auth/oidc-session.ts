import { InjectionToken, inject } from '@angular/core';
import { ErrorResponse, UserManager, UserManagerSettings, WebStorageStateStore } from 'oidc-client-ts';

import { AppConfig, AppConfigService } from '../app-config';
import { installSha256Fallback } from './insecure-crypto';

/**
 * Die Anmeldung am OIDC-Provider, so schmal wie `AuthService` sie braucht. Die Bibliothek bleibt hinter dieser
 * Schnittstelle, Tests ersetzen sie.
 */
export interface OidcSession {
  /** Stellt nach dem Neuladen der Seite die Sitzung her und liefert das Access-Token, `null` ohne gültige Sitzung. */
  restore(): Promise<string | null>;
  /** Leitet zum Provider weiter. `returnUrl` kommt nach der Anmeldung als Ziel zurück. */
  signIn(returnUrl: string): Promise<void>;
  /** Wertet die Rückkehr vom Provider aus (Adresse der Seite). */
  complete(): Promise<{ accessToken: string; returnUrl: string }>;
  /** Meldet auch am Provider ab und leitet dafür weiter. */
  signOut(): Promise<void>;
  /** Vergisst die Sitzung nur lokal. */
  clear(): Promise<void>;
  /**
   * Meldet das neue Access-Token nach jeder Erneuerung und `null`, wenn die Sitzung nicht mehr zu retten ist (das Token
   * ist abgelaufen). Gibt die Funktion zum Abbestellen zurück.
   */
  watch(callback: (token: string | null) => void): () => void;
}

/** So lange wartet die Erneuerung nach einem Netzfehler bis zum nächsten Versuch. */
export const RENEW_RETRY_MS = 15_000;

const CALLBACK_PATH = 'auth/callback';
const SIGNED_OUT_PATH = 'abgemeldet';

/** `OidcSession` mit `oidc-client-ts`: Authorization Code mit PKCE, Erneuerung per Refresh-Token. */
export class UserManagerSession implements OidcSession {
  private readonly manager: UserManager;

  /** `createManager` nur für Tests, sonst der echte `UserManager`. */
  constructor(
    config: AppConfig,
    createManager: (settings: UserManagerSettings) => UserManager = (settings) => new UserManager(settings),
  ) {
    if (config.oidc.allowInsecureContext) {
      installSha256Fallback();
    }
    this.manager = createManager({
      authority: config.oidc.authority,
      client_id: config.oidc.clientId,
      redirect_uri: new URL(CALLBACK_PATH, document.baseURI).href,
      post_logout_redirect_uri: new URL(SIGNED_OUT_PATH, document.baseURI).href,
      response_type: 'code',
      scope: 'openid profile',
      // Der Provider liefert die Namen im Token, das Backend legt den Spieler aus dem Token an. Ein Aufruf spart sich.
      loadUserInfo: false,
      // Erneuert das Token eine Minute vor Ablauf mit dem Refresh-Token, ohne Weiterleitung und ohne Iframe
      automaticSilentRenew: true,
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    });
  }

  async restore(): Promise<string | null> {
    try {
      let user = await this.manager.getUser();
      if (user?.expired) {
        user = await this.manager.signinSilent();
      }
      return user && !user.expired ? user.access_token : null;
    } catch {
      await this.manager.removeUser().catch(() => undefined);
      return null;
    }
  }

  signIn(returnUrl: string): Promise<void> {
    return this.manager.signinRedirect({ state: returnUrl });
  }

  async complete(): Promise<{ accessToken: string; returnUrl: string }> {
    const user = await this.manager.signinCallback();
    if (!user) {
      throw new Error('Vom Provider kam keine Anmeldung zurück.');
    }
    return { accessToken: user.access_token, returnUrl: typeof user.state === 'string' ? user.state : '/' };
  }

  signOut(): Promise<void> {
    return this.manager.signoutRedirect();
  }

  clear(): Promise<void> {
    return this.manager.removeUser();
  }

  watch(callback: (token: string | null) => void): () => void {
    const events = this.manager.events;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const renewLater = () => {
      retry = setTimeout(() => {
        this.manager.signinSilent().catch((error: unknown) => {
          if (!(error instanceof ErrorResponse)) {
            void this.manager.getUser().then((user) => user && !user.expired && renewLater());
          }
        });
      }, RENEW_RETRY_MS);
    };

    const removers = [
      events.addUserLoaded((user) => callback(user.access_token)),
      events.addUserUnloaded(() => callback(null)),
      events.addAccessTokenExpired(() => callback(null)),
      events.addSilentRenewError((error) => {
        // Antwortet der Provider mit einem Fehler (Sitzung beendet), hilft ein neuer Versuch nicht. Bei Netzfehlern schon.
        if (!(error instanceof ErrorResponse)) {
          renewLater();
        }
      }),
    ];
    return () => {
      clearTimeout(retry);
      removers.forEach((remove) => remove());
    };
  }
}

export const OIDC_SESSION = new InjectionToken<OidcSession>('OIDC_SESSION', {
  providedIn: 'root',
  factory: () => new UserManagerSession(inject(AppConfigService).config()),
});
