// What the workshop's parts on the page decide (the warm workshop, D8),
// with no 3D: the names of the room's spots, the line that says
// what Pip is doing, the way Explore's keys and stick steer him, and what a
// tap on the room means. Deck.tsx draws them.
import type { LessonId } from "@quest/contract";
import type { StationPoint } from "../path";
import type { SpotId } from "./layout";
import type { PipStatus, WorkshopPick } from "./store";

/** Each spot's name in the Send Pip to list, and in a sentence. */
export const SPOT_NAMES: Readonly<
  Record<SpotId, { label: string; inLine: string }>
> = {
  noticeboard: { label: "Noticeboard", inLine: "the noticeboard" },
  organizer: { label: "Kit organizer", inLine: "the kit organizer" },
  "release-desk": { label: "Release desk", inLine: "the release desk" },
  bench: { label: "Workbench", inLine: "the workbench" },
  shelf: { label: "Shelf", inLine: "the shelf" },
  tea: { label: "Tea table", inLine: "the tea table" },
  armchair: { label: "Armchair", inLine: "the armchair" },
};

/** The room's spots that are no Level's place, in the order the list shows them. */
export const OTHER_SPOTS: readonly SpotId[] = [
  "bench",
  "shelf",
  "tea",
  "armchair",
];

/**
 * What the live line says as Pip's status goes from `before` to `now`, or
 * null when nothing worth saying changed: he sets off, speeds up, arrives,
 * says hello, rests, falls asleep or wakes. Standing about says nothing.
 */
export function activityLine(before: PipStatus, now: PipStatus): string | null {
  if (before.activity === now.activity && before.at === now.at) return null;
  switch (now.activity) {
    case "walking":
      return before.activity === "walking" ? null : "Pip is walking";
    case "running":
      return before.activity === "running" ? null : "Pip is running";
    case "greeting":
      return "Pip says hello";
    case "celebrating":
      return "Pip is celebrating";
    case "thinking":
      return "Pip is pondering";
    case "resting":
      return "Pip is resting";
    case "asleep":
      return "Pip is asleep";
    case "idle":
      if (before.activity === "asleep") return "Pip is awake";
      if (before.activity === "walking" || before.activity === "running")
        return now.at === null
          ? "Pip stopped"
          : `Pip is at ${SPOT_NAMES[now.at].inLine}`;
      return null;
  }
}

/** How far Explore steers Pip across the floor: x toward the room's right, z toward the camera; length 0 to 1. */
export interface Steer {
  x: number;
  z: number;
  run: boolean;
}

/**
 * The keys that steer Pip while Explore is on, by `KeyboardEvent.code`, each
 * a way across the floor as the room's camera sees it (it faces the back
 * wall, so up is away from it): the arrows, and the letters beside them.
 */
export const STEER_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

/** The steer of the keys held, at full length whichever way; Shift held runs. */
export function keysSteer(held: ReadonlySet<string>, run: boolean): Steer {
  let x = 0;
  let z = 0;
  for (const code of held) {
    const way = STEER_KEYS[code];
    if (way === undefined) continue;
    x += way[0];
    z += way[1];
  }
  const length = Math.hypot(x, z);
  return length === 0
    ? { x: 0, z: 0, run: false }
    : { x: x / length, z: z / length, run };
}

/** Pushed past the stick's ring by this share of its reach, Pip runs. */
export const STICK_RUN = 1.05;

/** The stick's steer, from how far it is pushed from its centre (dx right, dy down) within a ring of `reach`. */
export function stickSteer(dx: number, dy: number, reach: number): Steer {
  const length = Math.hypot(dx, dy);
  if (length === 0 || reach <= 0) return { x: 0, z: 0, run: false };
  const share = Math.min(1, length / reach);
  return {
    x: (dx / length) * share,
    z: (dy / length) * share,
    run: length > reach * STICK_RUN,
  };
}

/** What a tap on the room does. */
export type RoomTap =
  | { type: "greet" }
  | { type: "open"; lesson: LessonId }
  | {
      type: "walk";
      to: Extract<NonNullable<WorkshopPick>, { kind: "floor" | "place" }>;
    }
  | null;

/**
 * What a tap at (x, y) on the room does, from the renderer's pick there and
 * the cards as drawn: on Pip, a greet; on a card within its reach (its
 * place's furniture or the floor before it), that Lesson's overview, the
 * nearest card if two reach; on a place or the floor, a walk there; on
 * nothing, nothing.
 */
export function roomTap(
  pick: WorkshopPick,
  cards: readonly StationPoint[],
  x: number,
  y: number,
): RoomTap {
  if (pick === null) return null;
  if (pick.kind === "pip") return { type: "greet" };
  let near: { lesson: LessonId; d: number } | null = null;
  for (const card of cards) {
    const d = Math.hypot(card.x - x, card.y - y);
    if (d <= card.r && (near === null || d < near.d))
      near = { lesson: card.lesson, d };
  }
  if (near !== null) return { type: "open", lesson: near.lesson };
  return { type: "walk", to: pick };
}

/** The elements a tap passes through to the room: the page's frame and the screens' own spacers, never a control or a surface. */
export const THROUGH_TO_ROOM =
  "[data-scene-behind], [data-screen], [data-room]";

/** Whether a tap on `target` is a tap on the room behind the page. */
export function tapsRoom(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target === document.body ||
    target === document.documentElement ||
    target.matches(THROUGH_TO_ROOM)
  );
}

/** Whether a key goes to a field that types, where Explore leaves it be. */
export function typesInto(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}
