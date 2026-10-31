import { HttpErrorResponse } from '@angular/common/http';

/**
 * Text für eine fehlgeschlagene Anfrage. Das Backend liefert Fehler als `application/problem+json`, das Feld `detail`
 * ist eine deutsche, anzeigbare Meldung.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
    if (error.status === 0) {
      return 'Das Backend ist nicht erreichbar.';
    }
  }
  return fallback;
}
