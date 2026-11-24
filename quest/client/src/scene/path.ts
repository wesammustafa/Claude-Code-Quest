// The Journey path (09 9.3, ticket 52): what the Journey's HTML and the
// Scene's renderer share about it, with no 3D code, so the screen reads it
// without loading the renderer. The Journey says which Station Pip stands
// at, whether the camera is pulled back to the whole Level, and where its
// stage band sits on the page; the renderer says, each frame it draws,
// where each Station and Pip fall on the page. One per page's Scene.
import { useContext } from "react";
import type { LessonId } from "@quest/contract";
import type { ScreenOnShow } from "../mount/types";
import { SceneContext, type SceneHub } from "./context";

/** A box on the page, in CSS pixels from the viewport's top left. */
export interface Band {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A Station as the renderer last drew it: where it falls on the page, how far round it reaches, and whether it is lit. */
export interface StationPoint {
  lesson: LessonId;
  x: number;
  y: number;
  r: number;
  lit: boolean;
}

/** What the renderer drew last: the Stations, and the point under Pip's feet, or null when none is drawn. */
export interface PathView {
  points: readonly StationPoint[];
  pip: { x: number; y: number } | null;
}

export interface JourneyPath {
  /** The Station Pip stands at, or null before the Journey names one. */
  at: () => LessonId | null;
  setAt: (lesson: LessonId) => void;
  /** Pulled back to the whole Level. */
  whole: () => boolean;
  setWhole: (whole: boolean) => void;
  /** The Journey's stage band on the page while it shows, or null. */
  band: () => Band | null;
  setBand: (band: Band | null) => void;
  /** The renderer is drawing the landscape, so the Journey may show its stage. */
  ready: () => boolean;
  setReady: (ready: boolean) => void;
  /** Called when at, whole, band or ready change. */
  subscribe: (fn: () => void) => () => void;
  view: () => PathView;
  setView: (view: PathView) => void;
  /** Called when the renderer draws a new view. */
  subscribeView: (fn: () => void) => () => void;
}

const NO_VIEW: PathView = { points: [], pip: null };

function emitter() {
  const listeners = new Set<() => void>();
  return {
    on: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    emit: () => {
      for (const fn of [...listeners]) fn();
    },
  };
}

const sameBand = (a: Band | null, b: Band | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height);

export function createJourneyPath(): JourneyPath {
  let at: LessonId | null = null;
  let whole = false;
  let band: Band | null = null;
  let ready = false;
  let view = NO_VIEW;
  const changes = emitter();
  const views = emitter();
  return {
    at: () => at,
    setAt: (next) => {
      if (next === at) return;
      at = next;
      changes.emit();
    },
    whole: () => whole,
    setWhole: (next) => {
      if (next === whole) return;
      whole = next;
      changes.emit();
    },
    band: () => band,
    setBand: (next) => {
      if (sameBand(next, band)) return;
      band = next;
      changes.emit();
    },
    ready: () => ready,
    setReady: (next) => {
      if (next === ready) return;
      ready = next;
      changes.emit();
    },
    subscribe: changes.on,
    view: () => view,
    setView: (next) => {
      view = next;
      views.emit();
    },
    subscribeView: views.on,
  };
}

const paths = new WeakMap<SceneHub, JourneyPath>();

/** The Journey path of a page's Scene, made the first time it is asked for. */
export function journeyPathOf(hub: SceneHub): JourneyPath {
  let path = paths.get(hub);
  if (path === undefined) {
    path = createJourneyPath();
    paths.set(hub, path);
  }
  return path;
}

/** The Journey path of the Scene around the caller. */
export function useJourneyPath(): JourneyPath {
  return journeyPathOf(useContext(SceneContext));
}

/** The Lesson a screen belongs to: its overview, step or complete route; null elsewhere. */
export function lessonOfScreen(screen: ScreenOnShow): LessonId | null {
  const m = /^\/lesson\/([^/]+)(?:\/(?:step|complete))?\/?$/.exec(screen.path);
  return m?.[1] ?? null;
}

/** The Station `by` places from `at` along `ids`, held at either end. */
export function stepStation(
  ids: readonly LessonId[],
  at: LessonId | null,
  by: number,
): LessonId | null {
  if (ids.length === 0) return null;
  const from = at === null ? -1 : ids.indexOf(at);
  if (from < 0) return ids[0] ?? null;
  return ids[Math.max(0, Math.min(ids.length - 1, from + by))] ?? null;
}

/**
 * The Station a key moves Pip to while a Lesson link has focus (or, for
 * left and right, no control has): the arrow keys one along, left and up
 * back, right and down on; null for any other key.
 */
export function stationForKey(
  ids: readonly LessonId[],
  at: LessonId | null,
  key: string,
): LessonId | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return stepStation(ids, at, 1);
    case "ArrowLeft":
    case "ArrowUp":
      return stepStation(ids, at, -1);
    default:
      return null;
  }
}

/** How far a pointer travels, in CSS pixels, before a press is a swipe or a drag rather than a tap. */
export const SWIPE_PX = 32;

/**
 * Which way a swipe or a drag moves Pip: a mostly sideways travel of at
 * least SWIPE_PX, leftward on (as the path runs) and rightward back; 0 for
 * a tap or an up and down travel, which scrolls the page.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** How far two fingers close or open, as a share of where they started, before a pinch pulls back or goes in. */
export const PINCH_SHARE = 0.2;

/** Whether a pinch leaves the camera pulled back: fingers closing pull back, opening go back in, a small change keeps it. */
export function pinchWhole(
  start: number,
  now: number,
  whole: boolean,
): boolean {
  if (start <= 0) return whole;
  if (now <= start * (1 - PINCH_SHARE)) return true;
  if (now >= start * (1 + PINCH_SHARE)) return false;
  return whole;
}

/** Whether a scroll leaves the camera pulled back: down pulls back, up goes back in. */
export function wheelWhole(deltaY: number, whole: boolean): boolean {
  if (deltaY > 0) return true;
  if (deltaY < 0) return false;
  return whole;
}

/** The Station under a point on the page: the nearest whose reach holds it, or null. */
export function stationAt(
  points: readonly StationPoint[],
  x: number,
  y: number,
): StationPoint | null {
  let best: StationPoint | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= p.r && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
