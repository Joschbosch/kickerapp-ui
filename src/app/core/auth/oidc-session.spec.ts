import { ErrorResponse, User, UserManager, UserManagerSettings } from 'oidc-client-ts';

import { AppConfig } from '../app-config';
import { RENEW_RETRY_MS, UserManagerSession } from './oidc-session';

const CONFIG: AppConfig = {
  apiBaseUrl: 'http://localhost:8080',
  authMode: 'oidc',
  oidc: { authority: 'http://localhost:8180/realms/kickertool', clientId: 'kickertool-app' },
};

type Handler = (arg?: unknown) => void;

/** Ein `UserManager` zum Steuern aus dem Test: merkt sich Aufrufe und Handler der Ereignisse. */
function fakeManager() {
  const handlers: Record<string, Handler[]> = {};
  const removed: string[] = [];
  const register = (name: string) => (callback: Handler) => {
    handlers[name] = [...(handlers[name] ?? []), callback];
    return () => {
      removed.push(name);
      handlers[name] = handlers[name].filter((entry) => entry !== callback);
    };
  };
  const manager = {
    getUser: vi.fn<() => Promise<User | null>>(),
    signinSilent: vi.fn<() => Promise<User | null>>(),
    signinRedirect: vi.fn<(args?: { state?: unknown }) => Promise<void>>().mockResolvedValue(undefined),
    signinCallback: vi.fn<() => Promise<User | undefined>>(),
    signoutRedirect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    removeUser: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    events: {
      addUserLoaded: register('loaded'),
      addUserUnloaded: register('unloaded'),
      addAccessTokenExpired: register('expired'),
      addSilentRenewError: register('renewError'),
    },
  };
  const fire = (name: string, arg?: unknown) => (handlers[name] ?? []).forEach((handler) => handler(arg));
  return { manager, fire, removed, handlers };
}

function user(overrides: Partial<{ access_token: string; expired: boolean; state: unknown }> = {}): User {
  return { access_token: 'token-1', expired: false, state: undefined, ...overrides } as unknown as User;
}

describe('UserManagerSession', () => {
  let fake: ReturnType<typeof fakeManager>;
  let settings: UserManagerSettings;
  let session: UserManagerSession;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fake = fakeManager();
    session = new UserManagerSession(CONFIG, (given) => {
      settings = given;
      return fake.manager as unknown as UserManager;
    });
  });

  afterEach(() => vi.useRealTimers());

  it('richtet den Client auf den Realm ein: Code-Flow, öffentlicher Client, Erneuerung vor Ablauf', () => {
    expect(settings.authority).toBe('http://localhost:8180/realms/kickertool');
    expect(settings.client_id).toBe('kickertool-app');
    expect(settings.response_type).toBe('code');
    expect(settings.scope).toBe('openid profile');
    expect(settings.client_secret).toBeUndefined();
    expect(settings.automaticSilentRenew).toBe(true);
    expect(settings.redirect_uri).toMatch(/\/auth\/callback$/);
    expect(settings.post_logout_redirect_uri).toMatch(/\/abgemeldet$/);
  });

  describe('Notbehelf für HTTP im lokalen Netz', () => {
    const original = Object.getOwnPropertyDescriptor(crypto, 'subtle');

    beforeEach(() => {
      Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      if (original) {
        Object.defineProperty(crypto, 'subtle', original);
      } else {
        Reflect.deleteProperty(crypto, 'subtle');
      }
    });

    const create = (config: AppConfig) => new UserManagerSession(config, () => fake.manager as unknown as UserManager);

    it('bleibt standardmäßig aus', () => {
      create(CONFIG);

      expect(crypto.subtle).toBeUndefined();
    });

    it('baut mit „allowInsecureContext“ ein SHA-256 ein', async () => {
      create({ ...CONFIG, oidc: { ...CONFIG.oidc, allowInsecureContext: true } });

      const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));

      expect(new Uint8Array(hashed)[0]).toBe(0xba);
    });
  });

  describe('restore', () => {
    it('liefert das Token einer gültigen gespeicherten Sitzung', async () => {
      fake.manager.getUser.mockResolvedValue(user());

      expect(await session.restore()).toBe('token-1');
      expect(fake.manager.signinSilent).not.toHaveBeenCalled();
    });

    it('liefert nichts ohne Sitzung', async () => {
      fake.manager.getUser.mockResolvedValue(null);

      expect(await session.restore()).toBeNull();
    });

    it('erneuert ein abgelaufenes Token mit dem Refresh-Token', async () => {
      fake.manager.getUser.mockResolvedValue(user({ expired: true }));
      fake.manager.signinSilent.mockResolvedValue(user({ access_token: 'token-2' }));

      expect(await session.restore()).toBe('token-2');
    });

    it('vergisst die Sitzung, wenn sich das Token nicht mehr erneuern lässt', async () => {
      fake.manager.getUser.mockResolvedValue(user({ expired: true }));
      fake.manager.signinSilent.mockRejectedValue(new ErrorResponse({ error: 'invalid_grant' }));

      expect(await session.restore()).toBeNull();
      expect(fake.manager.removeUser).toHaveBeenCalled();
    });
  });

  it('leitet zum Provider und gibt die Zielseite als State mit', async () => {
    await session.signIn('/turniere/42');

    expect(fake.manager.signinRedirect).toHaveBeenCalledWith({ state: '/turniere/42' });
  });

  describe('complete', () => {
    it('liefert Token und Zielseite der Rückkehr', async () => {
      fake.manager.signinCallback.mockResolvedValue(user({ state: '/turniere/42' }));

      expect(await session.complete()).toEqual({ accessToken: 'token-1', returnUrl: '/turniere/42' });
    });

    it('fällt ohne Zielseite auf die Startseite zurück', async () => {
      fake.manager.signinCallback.mockResolvedValue(user());

      expect((await session.complete()).returnUrl).toBe('/');
    });

    it('meldet, wenn nichts zurückkam', async () => {
      fake.manager.signinCallback.mockResolvedValue(undefined);

      await expect(session.complete()).rejects.toThrow('Vom Provider kam keine Anmeldung zurück.');
    });

    it('reicht Fehler des Providers weiter', async () => {
      fake.manager.signinCallback.mockRejectedValue(new ErrorResponse({ error: 'access_denied' }));

      await expect(session.complete()).rejects.toBeInstanceOf(ErrorResponse);
    });
  });

  it('meldet auch beim Provider ab', async () => {
    await session.signOut();

    expect(fake.manager.signoutRedirect).toHaveBeenCalled();
    expect(fake.manager.removeUser).not.toHaveBeenCalled();
  });

  it('vergisst die Sitzung lokal, ohne den Provider zu fragen', async () => {
    await session.clear();

    expect(fake.manager.removeUser).toHaveBeenCalled();
    expect(fake.manager.signoutRedirect).not.toHaveBeenCalled();
  });

  describe('watch', () => {
    let tokens: (string | null)[];

    beforeEach(() => {
      tokens = [];
      session.watch((token) => tokens.push(token));
    });

    it('meldet jedes erneuerte Token', () => {
      fake.fire('loaded', user({ access_token: 'token-2' }));
      fake.fire('loaded', user({ access_token: 'token-3' }));

      expect(tokens).toEqual(['token-2', 'token-3']);
    });

    it('meldet null, wenn das Token abgelaufen ist oder die Sitzung entfernt wurde', () => {
      fake.fire('expired');
      fake.fire('unloaded');

      expect(tokens).toEqual([null, null]);
    });

    it('versucht es nach einem Netzfehler bei der Erneuerung später noch einmal', async () => {
      fake.manager.getUser.mockResolvedValue(user());
      fake.manager.signinSilent.mockRejectedValueOnce(new Error('Netz weg')).mockResolvedValue(user());

      fake.fire('renewError', new Error('Netz weg'));
      expect(fake.manager.signinSilent).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS);
      expect(fake.manager.signinSilent).toHaveBeenCalledTimes(1);

      // der erste Versuch scheiterte wieder: ein weiterer folgt, solange das Token noch gilt
      await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS);
      expect(fake.manager.signinSilent).toHaveBeenCalledTimes(2);
    });

    it('hört auf zu versuchen, sobald das Token abgelaufen ist', async () => {
      fake.manager.getUser.mockResolvedValue(user({ expired: true }));
      fake.manager.signinSilent.mockRejectedValue(new Error('Netz weg'));

      fake.fire('renewError', new Error('Netz weg'));
      await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS * 5);

      expect(fake.manager.signinSilent).toHaveBeenCalledTimes(1);
    });

    it('versucht es nicht noch einmal, wenn der Provider die Erneuerung ablehnt', async () => {
      fake.fire('renewError', new ErrorResponse({ error: 'invalid_grant' }));

      await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS * 3);

      expect(fake.manager.signinSilent).not.toHaveBeenCalled();
    });
  });

  it('hört nach dem Abbestellen nicht mehr zu und versucht nichts mehr', async () => {
    const tokens: (string | null)[] = [];
    const stop = session.watch((token) => tokens.push(token));
    fake.fire('renewError', new Error('Netz weg'));

    stop();
    await vi.advanceTimersByTimeAsync(RENEW_RETRY_MS * 3);
    fake.fire('loaded', user());

    expect(fake.manager.signinSilent).not.toHaveBeenCalled();
    expect(tokens).toEqual([]);
    expect(fake.removed.sort()).toEqual(['expired', 'loaded', 'renewError', 'unloaded']);
  });
});
