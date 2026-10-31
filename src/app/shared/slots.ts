import { Slot } from '../api/models';

/**
 * Name für einen Platz im Team. Ein Dummy-Platz wird von einem Einspringer oder einem Gast aus dem Publikum gespielt,
 * beide bekommen für das Match keine Punkte.
 */
export function slotLabel(slot: Slot, playerId: string | null): string {
  if (slot.type === 'DUMMY') {
    return slot.standIn ? `${nameOf(slot.standIn, playerId)} (Einspringer)` : 'Gast';
  }
  return slot.player ? nameOf(slot.player, playerId) : 'Unbekannt';
}

function nameOf(player: { id: string; displayName: string }, playerId: string | null): string {
  return player.id === playerId ? `${player.displayName} (du)` : player.displayName;
}
