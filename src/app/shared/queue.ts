import { Match } from '../api/models';

/** Wo ein wartendes Match in der Warteschlange der Runde steht. */
export interface QueueInfo {
  /** Platz in der Warteschlange, ab 1. */
  position: number;
  /** In welcher der folgenden Wellen das Match drankommt: 1 = nächste Welle. */
  wave: number;
}

/**
 * Platz eines wartenden Matches. Die Warteschlange ist die Reihenfolge der Auslosung, die nächste Welle besteht aus den
 * ersten `tableCount` wartenden Matches, sobald alle am Tisch ein Ergebnis haben. Das ist nur die Anzeige dazu, ob es
 * dann wirklich so weitergeht, entscheidet das Backend.
 */
export function queueInfo(match: Match, roundMatches: Match[], tableCount: number): QueueInfo | null {
  if (match.status !== 'QUEUED') {
    return null;
  }
  const waiting = roundMatches.filter((entry) => entry.status === 'QUEUED').sort((a, b) => a.position - b.position);
  const index = waiting.findIndex((entry) => entry.id === match.id);
  if (index < 0) {
    return null;
  }
  return { position: index + 1, wave: Math.floor(index / Math.max(1, tableCount)) + 1 };
}

/** „Du bist in der nächsten Welle dran (Platz 2 in der Warteschlange).“ */
export function queueText(info: QueueInfo): string {
  const when = info.wave === 1 ? 'in der nächsten Welle' : info.wave === 2 ? 'in der übernächsten Welle' : `in ${info.wave} Wellen`;
  return `Du bist ${when} dran (Platz ${info.position} in der Warteschlange).`;
}
