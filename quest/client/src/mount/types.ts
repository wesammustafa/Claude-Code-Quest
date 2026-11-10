// The client mount: how a page other than the Local app's own (a host in the
// browser, say) mounts the client, on its own transport, router, added
// screens and slots. The Local app passes none of it but `live`.
import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import type { BeatKey, LessonId, StepId } from "@quest/contract";
import type { WhereKind } from "../components/Where";
import type { LiveDeps } from "../live/store";

export type { LiveDeps, WhereKind };

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
}

export interface ClientSlots {
  /** Rendered beside the Lesson column on a Lesson's step; with it, the screen lays out two regions. */
  practicePane?: ComponentType<{ beat: BeatOnScreen }>;
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
  /** On Lesson complete, before Next or the Level link. */
  lessonCompleteExtra?: ComponentType<{ lesson: LessonId }>;
  /** On Course complete, after the Level lists and before the buttons. */
  courseCompleteExtra?: ComponentType;
  /** Whether a Lesson may start; a closed one shows `Offer` instead. */
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
  /** Text in place of a pending Check bubble's running line; null restores it. */
  checkWaiting?: External<string | null>;
  /** Called synchronously inside the Next click, before the action is sent. */
  onStepNext?: (step: StepId) => void;
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
