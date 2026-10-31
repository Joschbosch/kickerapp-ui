import { Match, Slot } from '../api/models';
import { slotLabel } from './slots';

/** Mit wem der Spieler spielt und gegen wen, aus seiner Sicht. */
export interface Pairing {
  /** Der Partner, `null` wenn der Platz nicht besetzt ist. */
  partner: string | null;
  opponents: string[];
}

/** Partner und Gegner aus Sicht des Aufrufers, `null`, wenn er nicht in diesem Match steht. */
export function pairing(match: Match, playerId: string): Pairing | null {
  if (match.mySide === null) {
    return null;
  }
  const mine = match.mySide === 'A' ? match.teamA : match.teamB;
  const other = match.mySide === 'A' ? match.teamB : match.teamA;
  const isMe = (slot: Slot) => slot.player?.id === playerId || slot.standIn?.id === playerId;
  const partners = mine.members.filter((slot) => !isMe(slot)).map((slot) => slotLabel(slot, null));
  return { partner: partners[0] ?? null, opponents: other.members.map((slot) => slotLabel(slot, null)) };
}

/** „A“, „A und B“, „A, B und C“. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** „mit Anna gegen Ben und Clara“. */
export function pairingText(value: Pairing): string {
  const against = `gegen ${joinNames(value.opponents)}`;
  return value.partner ? `mit ${value.partner} ${against}` : against;
}
