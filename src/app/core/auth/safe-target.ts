/** Nur Ziele innerhalb der App, damit niemand über einen Parameter auf eine fremde Seite geleitet werden kann. */
export function safeTarget(target: string | null | undefined): string {
  return target != null && target.startsWith('/') && !target.startsWith('//') ? target : '/turniere';
}

const AUTO_LOGIN_KEY = 'kickertool.autologin';
const AUTO_LOGIN_PAUSE_MS = 15_000;

/**
 * Schutz vor einer Weiterleitungsschleife: Lehnt das Backend ein gültiges Token ab, würde die Anmeldeseite sofort wieder
 * zum Provider leiten, und der führt zurück. Kurz nach einer automatischen Weiterleitung gibt es deshalb keine zweite.
 */
export function recentAutoLogin(now = Date.now()): boolean {
  try {
    const last = Number(sessionStorage.getItem(AUTO_LOGIN_KEY));
    return last > 0 && now - last < AUTO_LOGIN_PAUSE_MS;
  } catch {
    return false;
  }
}

export function markAutoLogin(now = Date.now()): void {
  try {
    sessionStorage.setItem(AUTO_LOGIN_KEY, String(now));
  } catch {
    // Speicher gesperrt: dann gibt es auch den Schutz nicht
  }
}

export function clearAutoLogin(): void {
  try {
    sessionStorage.removeItem(AUTO_LOGIN_KEY);
  } catch {
    // nichts zu tun
  }
}
