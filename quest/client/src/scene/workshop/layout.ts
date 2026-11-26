// The workshop's floor plan (09 9.3): the room's walkable floor, the
// furniture Pip walks around, and the spots he stands at. The renderer
// draws the room from it and Pip routes over it; the screens only name
// places. Units are the Scene's: Pip stands about 1 tall. No 3D code here.
import type { WorkshopPlaceId } from "./places";

/** A box on the floor, from its corner nearest -x and -z to its far corner. */
export interface FloorRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** A point on the floor. */
export interface FloorPoint {
  x: number;
  z: number;
}

/** Where Pip stands at a spot, and the point at eye height he faces there. */
export interface Spot {
  stand: FloorPoint;
  look: readonly [x: number, y: number, z: number];
}

/** The Levels' places, then the room's other spots Pip may be sent to. */
export type SpotId = WorkshopPlaceId | "bench" | "shelf" | "tea" | "armchair";

/** The floor inside the walls. */
export const ROOM: FloorRect = { x0: -7, z0: -5, x1: 7, z1: 4.6 };

/** The furniture's footprints, which Pip routes around. */
export const FURNITURE: Readonly<Record<string, FloorRect>> = {
  bench: { x0: -1.5, z0: -0.75, x1: 1.5, z1: 0.75 },
  shelf: { x0: 1.2, z0: -5, x1: 4.2, z1: -4.45 },
  solder: { x0: -6.8, z0: -4.5, x1: -5.8, z1: -2.5 },
  armchair: { x0: -6.8, z0: -1.7, x1: -5.7, z1: -0.4 },
  tea: { x0: -6.3, z0: 1.5, x1: -4.9, z1: 2.8 },
  organizer: { x0: 6.25, z0: -3.3, x1: 7, z1: -1.1 },
  desk: { x0: 3.6, z0: 1.4, x1: 5.4, z1: 2.25 },
  entrance: { x0: 6.0, z0: 2.7, x1: 7, z1: 4.6 },
};

export const SPOTS: Readonly<Record<SpotId, Spot>> = {
  noticeboard: { stand: { x: -3.4, z: -3.95 }, look: [-3.4, 1.85, -4.95] },
  organizer: { stand: { x: 5.3, z: -1.7 }, look: [6.6, 1.0, -2.2] },
  "release-desk": { stand: { x: 4.6, z: 3.05 }, look: [6.4, 1.3, 3.6] },
  bench: { stand: { x: 0, z: 1.35 }, look: [0, 1.05, 0] },
  shelf: { stand: { x: 2.7, z: -3.75 }, look: [2.7, 1.3, -4.8] },
  tea: { stand: { x: -4.25, z: 2.15 }, look: [-5.6, 0.85, 2.15] },
  armchair: { stand: { x: -5.0, z: -1.05 }, look: [-6.3, 0.6, -1.05] },
};

/** Where Pip stands when the room first shows. */
export const PIP_START: FloorPoint = { x: 0.4, z: 3.0 };

/** How far round Pip's feet reach, which keeps him that far off the furniture. */
export const PIP_RADIUS = 0.34;
