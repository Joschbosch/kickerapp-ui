import { OidcSession } from '../core/auth/oidc-session';

/** Eine `OidcSession` zum Steuern aus dem Test. `renew(...)` löst die Meldung einer Token-Erneuerung aus. */
export function fakeOidcSession() {
  const watchers: ((token: string | null) => void)[] = [];
  const session = {
    restore: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    signIn: vi.fn<(returnUrl: string) => Promise<void>>().mockResolvedValue(undefined),
    complete: vi.fn<() => Promise<{ accessToken: string; returnUrl: string }>>(),
    signOut: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    clear: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    watch: vi.fn((callback: (token: string | null) => void) => {
      watchers.push(callback);
      return () => undefined;
    }),
  } satisfies OidcSession;
  return { session, renew: (token: string | null) => watchers.forEach((watcher) => watcher(token)) };
}
