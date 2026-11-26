// A Lesson's card pinned at its place (the warm workshop, D5, D10): the
// moment the card of a Lesson this tab has just completed goes up on its
// place, after its Badge reveal. The layer starts it, only from the reveal
// of the lesson.completed milestone this tab won, so only once the save has
// landed; the renderer draws the card settling into place over the
// moment's time. One per page's Scene. No 3D code here.
import { useContext, useSyncExternalStore } from "react";
import type { LessonId } from "@quest/contract";
import { SceneContext, type SceneHub } from "../context";

/** The card pinning now: its Lesson, when it started on `performance.now()`'s clock, and how long it takes (0 shows it pinned at once). */
export interface CardPin {
  lesson: LessonId;
  startedAt: number;
  ms: number;
}

export interface CardPins {
  /** The card pinning now, or null. */
  now: () => CardPin | null;
  set: (pin: CardPin | null) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createCardPins(): CardPins {
  let pin: CardPin | null = null;
  const listeners = new Set<() => void>();
  return {
    now: () => pin,
    set: (next) => {
      if (next === pin) return;
      pin = next;
      for (const fn of [...listeners]) fn();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

const pins = new WeakMap<SceneHub, CardPins>();

/** The card pins of a page's Scene, made the first time they are asked for. */
export function cardPinsOf(hub: SceneHub): CardPins {
  let made = pins.get(hub);
  if (made === undefined) {
    made = createCardPins();
    pins.set(hub, made);
  }
  return made;
}

/** The card pinning now in the Scene around the caller, followed as it changes. */
export function useCardPin(): CardPin | null {
  const of = cardPinsOf(useContext(SceneContext));
  return useSyncExternalStore(of.subscribe, of.now, () => null);
}
