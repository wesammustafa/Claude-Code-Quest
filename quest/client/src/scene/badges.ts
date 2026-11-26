// The Scene's Badges (09 9.3, ticket 53): the Badges a screen asks the
// Scene to draw in 3D in place of its SVG ones (Lesson complete's Badge and
// the Progress screen's Badge shelf), each at its HTML Badge's place, and
// the Badge reveal's events for whoever plays along with it (ticket 55's
// sound). One stage per page's Scene, kept beside its hub, so the shell and
// the hub need nothing new. No 3D code here: the screens read it without
// loading the renderer.
import {
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { BadgeSize } from "../components/Badge";
import { SceneContext, type SceneHub } from "./context";

/** A Badge reveal as it plays: the renderer draws it from these. */
export interface BadgeReveal {
  /** When it started, on `performance.now()`'s clock. */
  startedAt: number;
  /** How long it lasts, from `--duration-reveal`. */
  ms: number;
  /** One light for each passed Check line. */
  lights: number;
  /** Skipped or over: the Badge shows formed. */
  done: boolean;
}

/** One Badge the Scene draws in 3D, standing in for an HTML Badge's art. */
export interface BadgeSlot {
  lesson: string;
  earned: boolean;
  size: BadgeSize;
  /** The HTML Badge's art (its `svg`), whose box the 3D Badge takes. */
  element: Element;
  /** The turn asked for, in radians about the upright axis (the Badge shelf). */
  turn: number;
  /** The reveal, on Lesson complete's first completion; null for a formed Badge. */
  reveal: BadgeReveal | null;
}

/**
 * The Badge reveal's events, the hook point a sound or a camera move plays
 * along with (09 9.3, 9.5). `start` comes once per reveal: `drawn` is true
 * when the Scene plays it in 3D for `ms`, and false when its end state
 * shows in its place (the still tier, or no renderer yet), a cross-fade of
 * `ms`. Then exactly one of `skip` (a key or click ended a drawn reveal
 * early) or `end` (it ran its length). A reload, a second tab or a replay
 * of the Lesson reveals nothing and tells nothing.
 */
export type BadgeRevealEvent =
  | {
      type: "start";
      lesson: string;
      lights: number;
      ms: number;
      drawn: boolean;
    }
  | { type: "skip"; lesson: string }
  | { type: "end"; lesson: string };

/** A slot's handle for the screen that added it. */
export interface SlotHandle {
  /** Changes the slot in place: the renderer reads it on its next frame. */
  update: (patch: Partial<Omit<BadgeSlot, "element" | "lesson">>) => void;
  remove: () => void;
}

export interface BadgeStage {
  /** The slots now, in the order they were added. */
  slots: () => readonly BadgeSlot[];
  /** Called when a slot is added, changed or removed, or a drawer comes or goes. */
  subscribe: (fn: () => void) => () => void;
  add: (slot: BadgeSlot) => SlotHandle;
  /** The renderer marks itself as drawing the slots until the returned release is called. */
  attach: () => () => void;
  /** Whether a renderer draws the slots: only then does a 3D Badge stand in for an SVG one. */
  drawing: () => boolean;
  /**
   * The surfaces the renderer draws behind the Badges, each filling its
   * element's box: a card whose Badges stand in 3D (the Badge shelf) has
   * no page surface of its own, since that would hide them, so the Scene
   * draws it, and no Badge sits on the room.
   */
  surfaces: () => readonly Element[];
  /** Adds a surface until the returned release is called. */
  addSurface: (element: Element) => () => void;
  /** Follows the Badge reveal's events until the returned release is called. */
  onReveal: (fn: (event: BadgeRevealEvent) => void) => () => void;
  /** Tells every follower one of the reveal's events. */
  tell: (event: BadgeRevealEvent) => void;
}

export function createBadgeStage(): BadgeStage {
  let slots: readonly BadgeSlot[] = [];
  let surfaces: readonly Element[] = [];
  let drawers = 0;
  const listeners = new Set<() => void>();
  const followers = new Set<(event: BadgeRevealEvent) => void>();
  const changed = () => {
    for (const fn of [...listeners]) fn();
  };
  return {
    slots: () => slots,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    add: (slot) => {
      slots = [...slots, slot];
      changed();
      return {
        update: (patch) => {
          if (!slots.includes(slot)) return;
          Object.assign(slot, patch);
          changed();
        },
        remove: () => {
          if (!slots.includes(slot)) return;
          slots = slots.filter((s) => s !== slot);
          changed();
        },
      };
    },
    attach: () => {
      drawers += 1;
      if (drawers === 1) changed();
      let attached = true;
      return () => {
        if (!attached) return;
        attached = false;
        drawers -= 1;
        if (drawers === 0) changed();
      };
    },
    drawing: () => drawers > 0,
    surfaces: () => surfaces,
    addSurface: (element) => {
      surfaces = [...surfaces, element];
      changed();
      return () => {
        if (!surfaces.includes(element)) return;
        surfaces = surfaces.filter((e) => e !== element);
        changed();
      };
    },
    onReveal: (fn) => {
      followers.add(fn);
      return () => {
        followers.delete(fn);
      };
    },
    tell: (event) => {
      for (const fn of [...followers]) fn(event);
    },
  };
}

/** A motion token's duration in milliseconds, as the page sets it now; none where it is unset. */
export function tokenMs(name: string): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const m = /^(-?[\d.]+)(ms|s)$/.exec(value);
  if (m?.[1] === undefined) return 0;
  return Number(m[1]) * (m[2] === "s" ? 1000 : 1);
}

// One stage per hub: the Local app's shared no-Scene hub gets one too,
// which nothing draws, so nothing stands in for its SVG Badges.
const stages = new WeakMap<SceneHub, BadgeStage>();

/** The stage of a page's Scene. */
export function badgeStageOf(hub: SceneHub): BadgeStage {
  let stage = stages.get(hub);
  if (stage === undefined) {
    stage = createBadgeStage();
    stages.set(hub, stage);
  }
  return stage;
}

/** This page's Badge stage. */
export function useBadgeStage(): BadgeStage {
  return badgeStageOf(useContext(SceneContext));
}

/** Whether a renderer draws the stage's Badges now, followed as it changes. */
export function useBadgesDrawn(): boolean {
  const stage = useBadgeStage();
  return useSyncExternalStore(stage.subscribe, stage.drawing, () => false);
}

/** Has the Scene draw a surface behind the Badges in `element`'s box while `on` holds and the element is mounted. */
export function useBadgeSurface(
  element: RefObject<Element | null>,
  on: boolean,
): void {
  const stage = useBadgeStage();
  useEffect(() => {
    const el = element.current;
    if (!on || el === null) return;
    return stage.addSurface(el);
  }, [stage, element, on]);
}

/**
 * Follows the Badge reveal's events while the calling component is mounted:
 * the hook point for a sound, or anything else that plays along with the
 * reveal. The listener may change between renders; the latest one hears.
 */
export function useBadgeReveal(
  listener: (event: BadgeRevealEvent) => void,
): void {
  const stage = useBadgeStage();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  }, [listener]);
  useEffect(
    () =>
      stage.onReveal((event) => {
        latest.current(event);
      }),
    [stage],
  );
}
