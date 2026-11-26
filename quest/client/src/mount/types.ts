// The client mount: how a page other than the Local app's own (a host in the
// browser, say) mounts the client, on its own transport, router, added
// screens and slots. The Local app passes none of it but `live`.
import type { ComponentType } from "react";
import type { IconName } from "../components/Icon";
import type { RouteObject } from "react-router";
import type {
  ActiveLesson,
  BeatKey,
  LessonId,
  LevelId,
  StepId,
} from "@quest/contract";
import type { CheckLineState } from "../components/check-line-state";
import type { WhereKind } from "../components/where-kind";
import type { LiveDeps } from "../live/store";
import type { PipScreen } from "../pip/screen-name";

export type { CheckLineState, LiveDeps, WhereKind };

/**
 * A value the page holds outside React and the client reads as it changes.
 * `get()` returns the same value until `subscribe`'s listener is called.
 */
export interface External<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
}

export interface ClientMount {
  /** The transport: the stream, fetch and the tab's clock and timers. */
  live: LiveDeps;
  /** `"hash"` (the default, the Local app's) or `"browser"`, whose paths end in `/`. */
  router?: "hash" | "browser";
  /** Added screens, inside the shell before the not-found route; browser router only. */
  routes?: RouteObject[];
  slots?: ClientSlots;
  /**
   * Screen transitions: each route change animates the leaving screen out
   * and the new one in. Without it (the Local app) the new screen rises in
   * and the old one is gone at once.
   */
  transitions?: ScreenTransitions;
  /**
   * The Scene: one 3D space behind every screen but a Lesson's step. Without
   * it (the Local app) the screens paint their own background, as always,
   * and the page loads no 3D code.
   */
  scene?: SceneMount;
}

/** How the mount turns the Scene on. */
export interface SceneMount {
  /**
   * Loads the Scene's renderer: the page's own `import("@quest/client/scene")`,
   * so only a page that turns the Scene on bundles it. Called once, after the
   * first paint, the first time a screen that shows the Scene is on show.
   * A rejection keeps the still images, or today's screens without them.
   */
  load: () => Promise<{ default: ComponentType<SceneProps> }>;
  /** The Scene's colours in each theme. */
  look: Readonly<Record<SceneTheme, SceneLook>>;
  /**
   * The still image of a place, shown in place of the rendered Scene where
   * it cannot or should not run (no WebGL2, reduced motion, Save-Data, a
   * failure); null when there is none, which leaves today's screens.
   */
  still?: (at: { screen: ScreenOnShow; theme: SceneTheme }) => string | null;
  /**
   * Seam S13: true draws Pip in the Scene with the 3D renderer, from the
   * same director, wherever the Scene draws; the screen's own Pip stands
   * down once the model has loaded and drawn. Absent, the screens keep
   * their own Pip over the Scene.
   */
  pip?: boolean;
}

export type SceneTheme = "light" | "dark";

/**
 * The Scene's colours in one theme, as CSS hex colours, and its light. The
 * mount sets them so text over the Scene keeps its contrast in that theme.
 */
export interface SceneLook {
  /** What shows past the room's walls: the page's own background. */
  sky: string;
  /** The light the 3D Badges take from below. */
  ground: string;
  /** The light's colour. */
  light: string;
  /**
   * The 3D Badges' light, in Three.js's units (π lights a face fully):
   * `ambient` falls from the whole sky, `key` from one side.
   */
  ambient: number;
  key: number;
  /** The soft shadows on the floor, under Pip and the furniture, laid over it at their own opacity. */
  shadow: string;
  /** The workshop room's own colours, baked under its own light. */
  workshop: WorkshopLook;
}

/**
 * The workshop room's colours in one theme, as CSS hex colours, and the
 * light they are baked under: the look's `light` from above and one side,
 * bounced off the floor, and the hanging lamps' glow round each lamp.
 */
export interface WorkshopLook {
  /**
   * The room's light, in Three.js's units (π lights a face fully):
   * `ambient` falls from everywhere, `key` from the windows' side, and
   * `lamp` is how strongly the lamps light what is near them (0 for none).
   */
  ambient: number;
  key: number;
  lamp: number;
  /** The floor's planks. */
  floor: string;
  /** The walls; their panelling is mixed from it and `wood`. */
  wall: string;
  /** The furniture's wood; its legs and frames are a darker shade of it. */
  wood: string;
  /** The armchair, the rug's border and the red things on the bench. */
  fabric: string;
  /** The kit organizer and the lamps' shades. */
  teal: string;
  /** The plants. */
  leaf: string;
  /** The window panes, drawn unshaded: the day outside, or the evening. */
  window: string;
  /** The lamps' bulbs, drawn unshaded, and the colour of the light they cast. */
  glow: string;
  /** A Lesson's card, and the lines written on it. */
  paper: string;
  ink: string;
  /** A complete Lesson's card; the pin that holds it is a deeper shade of it. */
  done: string;
  /** An optional Lesson's card. */
  optional: string;
  /** The mark on a place's next card. */
  next: string;
}

/**
 * A Lesson as the Scene's Station for it: its Level, whether it is optional
 * (a lab), and whether it is complete, the snapshot's `LessonSummary`
 * `optional` and `complete`.
 */
export interface SceneStation {
  lesson: LessonId;
  level: LevelId;
  optional: boolean;
  complete: boolean;
}

/**
 * How the Scene is drawn: `"desktop"` in full, `"phone"` at a capped pixel
 * ratio with no shadows or post effects and a frame only when something
 * moves, `"still"` as still images with no render loop.
 */
export type SceneTier = "desktop" | "phone" | "still";

/** What the Scene's renderer is told. */
export interface SceneProps {
  screen: ScreenOnShow;
  /** The active Lesson, its phase and, while playing, its Step, as the snapshot says; null before the first snapshot. */
  lesson: LessonId | null;
  phase: ActiveLesson["phase"] | null;
  step: StepId | null;
  /** Every Lesson of the course in order, as its Station; empty before the first snapshot. */
  stations: readonly SceneStation[];
  tier: Exclude<SceneTier, "still">;
  /**
   * False while a Lesson's step shows (a Step-down too) or the page is
   * hidden: the render loop is stopped and nothing is drawn.
   */
  running: boolean;
  theme: SceneTheme;
  look: SceneLook;
  /** Called once the first frame is drawn; the Scene then fades in. */
  onReady: () => void;
  /** Called when the renderer cannot go on (its WebGL context is lost): the still images show. */
  onLost: () => void;
  /** Seam S13: the mount's `pip`, so the renderer draws the 3D Pip. */
  pip?: boolean;
}

/** How the screens change when the mount turns screen transitions on. */
export interface ScreenTransitions {
  /**
   * The mount's own move for a screen change, such as a camera move behind
   * the screens. Called once per route change, before the new screen's first
   * frame. `"under"` plays the move under the screens' exit and enter;
   * `"instead"` plays it in their place. It ends within `change.cap`.
   */
  move?: (change: ScreenChange) => "under" | "instead";
}

/** A route change, as the mount's move is told it. */
export interface ScreenChange {
  from: ScreenOnShow;
  to: ScreenOnShow;
  /** The Motion standard's cap in milliseconds (--duration-slow; 120 under reduced motion). */
  cap: number;
  /** Reduced motion is on: the move is a cross-fade with no travel. */
  reduced: boolean;
  /** Aborted at the cap, or when a new route change interrupts the move: it ends where it stands. */
  signal: AbortSignal;
}

/** A screen by its path (with no trailing `/`) and the name Pip's director gives it. */
export interface ScreenOnShow {
  path: string;
  screen: PipScreen;
}

export interface ClientSlots {
  /**
   * Rendered beside the Lesson column on a Lesson's step; with it, the screen
   * lays out two regions. The pane calls `onInput` when it sends input to the
   * terminal, which collapses a narrow screen's expanded strip.
   */
  practicePane?: ComponentType<{ beat: BeatOnScreen; onInput: () => void }>;
  /** What a Step's Command blocks do: Copy (the default) or Insert. */
  command?:
    | { action: "copy" }
    | { action: "insert"; insert: (req: InsertRequest) => InsertResult };
  /** The Where chip's labels, shown as given, and what pressing it does. */
  where?: {
    labels: Record<WhereKind, string>;
    focus?: (kind: WhereKind, terminal: number | null) => void;
  };
  /** At the start of the step actions, before Back. */
  stepActionsStart?: ComponentType;
  /** In Settings, after Work folders and before Help. */
  settingsSections?: readonly ComponentType[];
  settingsHide?: readonly ("work-folders" | "release" | "codespace")[];
  /** At the end of the top bar's main nav. */
  topBarEnd?: ComponentType;
  /** In the top bar's main nav after Progress, drawn as Journey and Progress are. */
  mainLinks?: readonly { to: string; icon: IconName; label: string }[];
  /**
   * `false` leaves "Read the full lesson" off a Step's header, for a mount
   * that offers the Lesson pages on a screen of its own. The overview and
   * Lesson complete keep theirs.
   */
  stepReadLesson?: boolean;
  /** On Lesson complete, before Next or the Level link. */
  lessonCompleteExtra?: ComponentType<{ lesson: LessonId }>;
  /**
   * On Lesson complete, in place of the link to the reference solution on
   * GitHub: a mount that serves the solutions itself shows them here.
   */
  lessonCompleteReference?: ComponentType<{ lesson: LessonId }>;
  /**
   * On a finished Lesson's overview, under the line that says it is
   * finished: a mount that keeps the Learner's finished work shows it here.
   */
  lessonOverviewDone?: ComponentType<{ lesson: LessonId }>;
  /** On Course complete, after the Level lists and before the buttons. */
  courseCompleteExtra?: ComponentType;
  /**
   * Whether a Lesson may start; a closed one shows `Offer` instead, on its
   * overview and on its step route (a resume or a deep link).
   */
  lessonAccess?: {
    get(lesson: LessonId): LessonAccess;
    subscribe(fn: () => void): () => void;
    Offer: ComponentType<{
      lesson: LessonId;
      offer: "keep-going" | "needs-connection";
    }>;
  };
  /** The product's words: its name (the tab title too), the waiting line, and one line added on Welcome. */
  copy?: { productName: string; waitingLine: string; welcomeLine?: string };
  /** The top bar's brand, in place of Pip's icon and the app's name. */
  brand?: { mark: ComponentType; title: string };
  /** The notice strip under the top bar. */
  notices?: External<readonly Notice[]>;
  /** Under a beat's Check lines. */
  checkLinesExtra?: ComponentType<{ beat: BeatKey; pass: boolean }>;
  /** With each of a beat's Check lines, after what the Check saw under it. */
  checkLine?: ComponentType<CheckLineSlotProps>;
  /** Text in place of a pending Check bubble's running line; null restores it. */
  checkWaiting?: External<string | null>;
  /** Called synchronously inside a forward Next click, from the action bar or Steps panel, before the action is sent. */
  onStepNext?: (step: StepId) => void;
}

/** One Check line, as the `checkLine` slot is told it. */
export interface CheckLineSlotProps {
  beat: BeatKey;
  /** The line's place among the beat's Check lines, from 0. */
  index: number;
  state: CheckLineState;
  /** The line's words, as plain text: a backticked span is code on screen. */
  text: string;
  /**
   * What shows under the line, in order, as plain text: the Not yet words
   * (backticks as in `text`), "Found `<path>`." for a matched file, and what
   * the passing look saw, as it is. Empty when nothing shows.
   */
  evidence: readonly string[];
}

/** The beat on screen, as the practice pane is told it. */
export interface BeatOnScreen {
  lesson: LessonId;
  step: StepId;
  beat: number;
  where: WhereKind | null;
  terminal: number | null;
}

export interface Notice {
  id: string;
  text: string;
  tone: "info" | "wait";
  action?: { label: string; run(): void };
}

export type LessonAccess =
  { open: true } | { open: false; offer: "keep-going" | "needs-connection" };

/** What Insert asks the page to put into the Where's prompt. */
export interface InsertRequest {
  text: string;
  where: WhereKind | null;
  terminal: number | null;
}

/** `"asked"`: a draft was there, and the page asks before replacing it. */
export type InsertResult = "inserted" | "asked";

/** A route's `handle`, for an added route that reuses a screen's frame. */
export interface QuestRouteHandle {
  /** `"welcome"`: no top bar, Pip on Welcome. `"journey"`: the pending moment link, Pip on the map. */
  screen?: "welcome" | "journey";
  /** Opens the Settings panel on arrival. */
  settings?: true;
}
