import type { EntryPoint } from '@/lib/store/useRoomStore';

/**
 * Canonical mapping from an {@link EntryPoint} (`wall` + `position`) to its
 * concrete grid-edge tile for a room of the given `gridSize`.
 *
 * Shared between the client scene (rendering + `isPlaceableFor` checks) and
 * the server action (`buyAndPlaceFurniture` placement validation) so both
 * sides of the boundary agree exactly on which tiles are entry points.
 *
 * Returns `null` if `position` falls outside `[0, gridSize - 1]`.
 */
export function entryTileFor(
  ep: EntryPoint,
  gridSize: number,
): { x: number; y: number } | null {
  const max = gridSize - 1;
  if (ep.position < 0 || ep.position > max) return null;
  switch (ep.wall) {
    case 'north': return { x: ep.position, y: 0 };
    case 'south': return { x: ep.position, y: max };
    case 'east':  return { x: max,         y: ep.position };
    case 'west':  return { x: 0,           y: ep.position };
  }
}

/**
 * Computes the default entry points that are unlocked at a given room level.
 * Handles the GDD §5.1 entry point expansion:
 * - Level 1–4: 3 entries (Door, Window, Vent)
 * - Level 5–9: 4 entries (+Skylight modeled as a Vent on West wall)
 * - Level 10–14: 5 entries (+Breach Wall modeled as a Door on North wall at pos 2)
 * - Level 15–19: 6 entries (+Second Window on South wall at pos 2)
 * - Level 20+: 7 entries (+Tunnel modeled as a Door on East wall at pos 2)
 */
export function entryPointsForLevel(roomLevel: number, gridSize: number): EntryPoint[] {
  const center = Math.floor(gridSize / 2);
  const eps: EntryPoint[] = [
    { type: 'door', wall: 'south', position: center },
    { type: 'window', wall: 'east', position: center },
    { type: 'vent', wall: 'north', position: center },
  ];

  if (roomLevel >= 5) {
    eps.push({ type: 'vent', wall: 'west', position: center });
  }
  if (roomLevel >= 10) {
    eps.push({ type: 'door', wall: 'north', position: 2 });
  }
  if (roomLevel >= 15) {
    eps.push({ type: 'window', wall: 'south', position: 2 });
  }
  if (roomLevel >= 20) {
    eps.push({ type: 'door', wall: 'east', position: 2 });
  }

  return eps;
}
