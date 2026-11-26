// What lies under a point of the page (the warm workshop, D8): the nearest
// thing the ray from the camera meets that is tagged as Pip or a place,
// else the spot it meets on the floor inside the room, else nothing. The
// renderer casts the ray; this reads what it met, with no Three.js, so a
// test holds every case.
import type { WorkshopPick } from "../../workshop/store";
import { ROOM, type FloorPoint } from "../../workshop/layout";
import type { WorkshopPlaceId } from "../../workshop/places";

/** An object the ray met, as the scene holds it: its tag, whether it shows, and what holds it. */
export interface PickNode {
  userData: Record<string, unknown>;
  visible: boolean;
  parent: PickNode | null;
}

const PLACES: ReadonlySet<string> = new Set<WorkshopPlaceId>([
  "noticeboard",
  "organizer",
  "release-desk",
]);

/** The tag an object carries in `userData.pick`, read only if it is one the workshop knows. */
function tagOf(data: unknown): WorkshopPick {
  if (typeof data !== "object" || data === null) return null;
  const tag = data as { kind?: unknown; place?: unknown };
  if (tag.kind === "pip") return { kind: "pip" };
  if (
    tag.kind === "place" &&
    typeof tag.place === "string" &&
    PLACES.has(tag.place)
  )
    return { kind: "place", place: tag.place as WorkshopPlaceId };
  return null;
}

/** The nearest tag over a met object, or null when it carries none or it, or anything holding it, is hidden. */
function taggedOver(node: PickNode): WorkshopPick {
  let tag: WorkshopPick = null;
  for (let at: PickNode | null = node; at !== null; at = at.parent) {
    if (!at.visible) return null;
    tag ??= tagOf(at.userData.pick);
  }
  return tag;
}

/**
 * What the pick finds: the first of `hits` (nearest first, as a raycast
 * gives them) tagged as Pip or a place, else `floor`, the ray's meeting with
 * the floor, when it lies inside the room; else nothing.
 */
export function pickOf(
  hits: readonly { object: PickNode }[],
  floor: FloorPoint | null,
): WorkshopPick {
  for (const hit of hits) {
    const tag = taggedOver(hit.object);
    if (tag !== null) return tag;
  }
  if (
    floor !== null &&
    floor.x >= ROOM.x0 &&
    floor.x <= ROOM.x1 &&
    floor.z >= ROOM.z0 &&
    floor.z <= ROOM.z1
  )
    return { kind: "floor", x: floor.x, z: floor.z };
  return null;
}

/** Where a ray from `origin` along `direction` meets the floor (y 0), or null when it never does. */
export function floorHit(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
): FloorPoint | null {
  if (direction.y >= 0 || origin.y <= 0) return null;
  const t = -origin.y / direction.y;
  return { x: origin.x + direction.x * t, z: origin.z + direction.z * t };
}
