// The workshop (the warm workshop, D8): what its screens' HTML and the
// Scene's renderer share, with no 3D code, so a screen reads it without
// loading the renderer. The renderer says, each frame it draws, where named
// things fall on the page, what lies under a point of the page, and what
// Pip is doing and where; the screens tell Pip where to go and what to do.
// One per page's Scene, as the Journey path is.
import { useCallback, useContext, useEffect, type RefObject } from "react";
import type { LessonId } from "@quest/contract";
import { SceneContext, type SceneHub } from "../context";
import type { Band } from "../path";
import type { SpotId } from "./layout";
import type { WorkshopPlaceId } from "./places";

/** Something the renderer places on the page: a place, Pip, or a Lesson's card. */
export type AnchorId = WorkshopPlaceId | "pip" | `card:${LessonId}`;

/**
 * Where an anchor falls on the page, in CSS pixels from the viewport's top
 * left; whether it is in view; and whether it lies ahead of the camera,
 * where x and y still point its way when it falls off the page.
 */
export interface Anchor {
  x: number;
  y: number;
  visible: boolean;
  ahead: boolean;
}

/** The anchors the renderer drew last; one it does not draw is absent. */
export type Anchors = Readonly<Partial<Record<AnchorId, Anchor>>>;

/** What lies under a point of the page: Pip, a place, a spot on the floor (in the Scene's own units), or nothing. */
export type WorkshopPick =
  | { kind: "pip" }
  | { kind: "place"; place: WorkshopPlaceId }
  | { kind: "floor"; x: number; z: number }
  | null;

/** The renderer's pick, from a point of the page in client coordinates. */
export type WorkshopPicker = (clientX: number, clientY: number) => WorkshopPick;

/** What the screens ask of Pip. */
export type PipCommand =
  | {
      type: "goTo";
      /** A spot of the room (a Level's place or one of the others) or a point of its floor. */
      to: { spot: SpotId } | { floor: { x: number; z: number } };
      pace?: "walk" | "run" | "auto";
    }
  | { type: "greet" }
  /** Steer him by hand (Explore), the way across the floor and whether he runs. */
  | { type: "steer"; x: number; z: number; run: boolean }
  | { type: "explore"; on: boolean }
  | { type: "stop" };

export type PipActivity =
  | "idle"
  | "walking"
  | "running"
  | "resting"
  | "asleep"
  | "thinking"
  | "greeting"
  | "celebrating";

/** What Pip is doing, and the spot he stands at, or null between spots. */
export interface PipStatus {
  activity: PipActivity;
  at: SpotId | null;
}

/**
 * Where a screen puts the workshop's parts that ride on the Scene (Pip's
 * bubble and toolbar, the place tags, Explore): an element of its own on
 * the page, and how much of the workshop it holds: the whole room, Pip's
 * buttons alone in the screen's flow, or Pip's bubble alone, saying the
 * screen's `line` over his head.
 */
export type DeckHost =
  | { element: HTMLElement; kind: "room" | "inline" }
  | { element: HTMLElement; kind: "pip"; line: string };

/** One of Pip's feet in a probe's frame: where the model draws it, in the world, and whether his gait stands it on the floor. */
export interface ProbeFoot {
  x: number;
  y: number;
  z: number;
  planted: boolean;
}

/** One frame of Pip's walk, in the Scene's units, for measuring his motion. */
export interface ProbeFrame {
  /** Seconds of his motion since he was first drawn. */
  t: number;
  x: number;
  z: number;
  /** Units a second. */
  speed: number;
  /** Both feet off the floor. */
  airborne: boolean;
  /** His turn about the vertical, in radians: 0 faces +z, toward the room's front. */
  facing: number;
  /** His left foot, then his right. */
  feet: readonly [ProbeFoot, ProbeFoot];
}

/** What measures Pip's motion: the renderer calls it with each frame it draws. */
export type PipProbe = (frame: ProbeFrame) => void;

export interface Workshop {
  anchors: () => Anchors;
  /** Publishes the anchors drawn; telling no one when none moved by half a CSS pixel or more, or came, went or changed view. */
  setAnchors: (anchors: Anchors) => void;
  subscribeAnchors: (fn: () => void) => () => void;
  /** What lies under the point, from the renderer's pick; null while no renderer picks. */
  pick: (clientX: number, clientY: number) => WorkshopPick;
  /** Registers the renderer's pick until the returned release is called. */
  setPick: (picker: WorkshopPicker) => () => void;
  /**
   * Tells the renderer's listeners; with none, the command is dropped, never
   * queued. So the renderer listens before it sets ready, and a screen sends
   * only once ready is true.
   */
  send: (command: PipCommand) => void;
  onCommand: (fn: (command: PipCommand) => void) => () => void;
  status: () => PipStatus;
  setStatus: (status: PipStatus) => void;
  subscribeStatus: (fn: () => void) => () => void;
  /** The renderer is drawing the workshop, so the screens may show what rides on it. */
  ready: () => boolean;
  setReady: (ready: boolean) => void;
  subscribeReady: (fn: () => void) => () => void;
  /** The screen's place for the workshop's parts, or null where none is on show. */
  host: () => DeckHost | null;
  /** Sets the host until the returned release is called. */
  setHost: (host: DeckHost) => () => void;
  subscribeHost: (fn: () => void) => () => void;
  /** Welcome's card on the page, which the camera keeps Pip clear of, or null while none is measured. */
  card: () => Band | null;
  /** Sets the card, telling the listeners when it moved, came or went. */
  setCard: (card: Band | null) => void;
  subscribeCard: (fn: () => void) => () => void;
  /** The probe set to measure Pip's motion, or null; only a test sets one. */
  probe?: () => PipProbe | null;
  setProbe?: (probe: PipProbe | null) => void;
}

/** Anchors closer than this, in CSS pixels, to the last ones published count as unmoved. */
const ANCHOR_SLACK = 0.5;

const NO_ANCHORS: Anchors = {};
const IDLE: PipStatus = { activity: "idle", at: null };

function listeners<T extends unknown[]>() {
  const fns = new Set<(...args: T) => void>();
  return {
    on: (fn: (...args: T) => void) => {
      fns.add(fn);
      return () => {
        fns.delete(fn);
      };
    },
    emit: (...args: T) => {
      for (const fn of [...fns]) fn(...args);
    },
  };
}

const anchorKeys = (anchors: Anchors) => Object.keys(anchors) as AnchorId[];

function sameAnchors(a: Anchors, b: Anchors): boolean {
  const keys = anchorKeys(a);
  if (keys.length !== anchorKeys(b).length) return false;
  return keys.every((key) => {
    const p = a[key];
    const q = b[key];
    return (
      p !== undefined &&
      q !== undefined &&
      p.visible === q.visible &&
      p.ahead === q.ahead &&
      Math.abs(p.x - q.x) < ANCHOR_SLACK &&
      Math.abs(p.y - q.y) < ANCHOR_SLACK
    );
  });
}

function sameBand(a: Band | null, b: Band | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

export function createWorkshop(): Workshop {
  let anchors = NO_ANCHORS;
  let picker: WorkshopPicker | null = null;
  let status = IDLE;
  let ready = false;
  let probe: PipProbe | null = null;
  let host: DeckHost | null = null;
  let card: Band | null = null;
  const drawn = listeners<[]>();
  const hosts = listeners<[]>();
  const commands = listeners<[PipCommand]>();
  const statuses = listeners<[]>();
  const readies = listeners<[]>();
  const cards = listeners<[]>();
  return {
    anchors: () => anchors,
    setAnchors: (next) => {
      if (sameAnchors(next, anchors)) return;
      anchors = next;
      drawn.emit();
    },
    subscribeAnchors: drawn.on,
    pick: (x, y) => picker?.(x, y) ?? null,
    setPick: (next) => {
      picker = next;
      return () => {
        if (picker === next) picker = null;
      };
    },
    send: commands.emit,
    onCommand: commands.on,
    status: () => status,
    setStatus: (next) => {
      if (next.activity === status.activity && next.at === status.at) return;
      status = next;
      statuses.emit();
    },
    subscribeStatus: statuses.on,
    ready: () => ready,
    setReady: (next) => {
      if (next === ready) return;
      ready = next;
      readies.emit();
    },
    subscribeReady: readies.on,
    host: () => host,
    setHost: (next) => {
      host = next;
      hosts.emit();
      return () => {
        if (host !== next) return;
        host = null;
        hosts.emit();
      };
    },
    subscribeHost: hosts.on,
    card: () => card,
    setCard: (next) => {
      if (sameBand(card, next)) return;
      card = next;
      cards.emit();
    },
    subscribeCard: cards.on,
    probe: () => probe,
    setProbe: (next) => {
      probe = next;
    },
  };
}

const workshops = new WeakMap<SceneHub, Workshop>();

/** The workshop of a page's Scene, made the first time it is asked for. */
export function workshopOf(hub: SceneHub): Workshop {
  let workshop = workshops.get(hub);
  if (workshop === undefined) {
    workshop = createWorkshop();
    workshops.set(hub, workshop);
  }
  return workshop;
}

/** The workshop of the Scene around the caller. */
export function useWorkshop(): Workshop {
  return workshopOf(useContext(SceneContext));
}

/**
 * A ref for the element a screen keeps for the workshop's parts: while it
 * is on the page, the renderer draws them there (`kind` says how many;
 * for Pip's bubble alone, `line` is what he says).
 */
export function useDeckHost(
  kind: "room" | "inline",
): (element: HTMLElement | null) => (() => void) | undefined;
export function useDeckHost(
  kind: "pip",
  line: string,
): (element: HTMLElement | null) => (() => void) | undefined;
export function useDeckHost(
  kind: DeckHost["kind"],
  line = "",
): (element: HTMLElement | null) => (() => void) | undefined {
  const workshop = useWorkshop();
  return useCallback(
    (element: HTMLElement | null) =>
      element === null
        ? undefined
        : workshop.setHost(
            kind === "pip" ? { element, kind, line } : { element, kind },
          ),
    [workshop, kind, line],
  );
}

/**
 * Tells the camera where Welcome's card stands on the page, followed as the
 * page scrolls or resizes, while `card` is mounted: the room keeps Pip
 * clear of it. Read once the page is laid out, never in the commit that
 * mounts the screen.
 */
export function useWelcomeCard(card: RefObject<HTMLElement | null>): void {
  const workshop = useWorkshop();
  useEffect(() => {
    const el = card.current;
    if (el === null) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      workshop.setCard({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    };
    const resized =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (resized === null) measure();
    else {
      resized.observe(el);
      resized.observe(document.documentElement);
    }
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      resized?.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      workshop.setCard(null);
    };
  }, [workshop, card]);
}
