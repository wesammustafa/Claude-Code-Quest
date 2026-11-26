// The page shapes every screen is built on.

/** A Lesson screen: one column of about 720 px, which fits half a laptop screen. */
export const COLUMN =
  "mx-auto grid max-w-column gap-5 px-5 pt-8 pb-24 [&>*]:min-w-0";

/** The Lesson workspace: COLUMN with room below for the sticky action bar. */
export const WORKSPACE_COLUMN =
  "mx-auto grid max-w-column gap-5 px-5 pt-8 pb-[calc(var(--action-bar-height)+--spacing(8))] [&>*]:min-w-0";

/**
 * The Lesson column beside a practice pane: the region sets its width, and
 * the action bar sits inside it, so no room is kept below for it.
 */
export const PANE_COLUMN = "grid gap-5 px-5 pt-8 pb-8 [&>*]:min-w-0";

/** The Learning journey: a wider page. */
export const WIDE =
  "mx-auto grid max-w-wide gap-5.5 px-6 pt-9 pb-24 max-sm:px-5";

/** The Learning journey over the workshop room: its phone gutter is the page's 16 px. */
export const ROOM_WIDE =
  "mx-auto grid max-w-wide gap-5.5 px-6 pt-9 pb-24 max-sm:px-4";

/** A calm, centred moment: Welcome, Lesson complete. */
export const MOMENT =
  "mx-auto grid min-h-(--moment-height) max-w-hero content-center justify-items-center gap-4 px-5 pt-8 pb-24 text-center";

/** A surface card. */
export const BOX =
  "grid gap-3 rounded-lg border border-line bg-surface p-5 shadow-sm";

/** A small label above a heading. */
export const EYEBROW =
  "text-xs font-heading tracking-eyebrow text-muted uppercase";

/** A quiet text link drawn as a button. */
export const QUIET_LINK =
  "rounded-sm px-0.5 py-1 text-sm text-muted underline underline-offset-3 transition-colors duration-(--duration-fast) ease-out hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * A screen over the running Scene (the warm workshop): the page under the
 * sticky top (the top bar and any notice), holding the screen's panel
 * beside the room on the right, or under it on a narrow page, where the
 * camera leaves the room its share (scene/renderer/camera.ts: the left
 * 60%, or the top half).
 */
export const SCENE_STAGE =
  "flex h-[calc(var(--page-min-height)-var(--top-height))] flex-col items-end p-4 scene-narrow:items-stretch scene-narrow:justify-end";

/**
 * The panel on a Scene screen's stage: two fifths of the page across at
 * most, or at most five eighths of its height below the room (the
 * prototype's phone sheet), scrolling in itself.
 * The stood-down box of a screen's Pip collapses in it, and the tail of
 * the bubble beside it goes: the Scene's Pip stands in the room. Focus
 * moved inside it stops clear of a sticky foot (WCAG 2.4.11).
 */
export const SCENE_PANEL =
  "grid max-h-full w-2/5 max-w-136 scroll-pb-28 content-start gap-5 overflow-y-auto overscroll-contain scene-narrow:max-h-5/8 scene-narrow:scroll-pb-48 scene-narrow:w-auto scene-narrow:max-w-none [&>*]:min-w-0 [&_[data-pip-stood-down]]:hidden [&_[data-pip-stood-down]+*_[data-says-bubble]]:before:hidden";

/** An opaque card for words over the Scene: no page text sits on the room itself. */
export const SURFACE = "rounded-xl border border-line bg-surface shadow-md";

/** A Badge's name, under its art, on a surface of its own where the art sits on the room (the Scene's 3D Badge drawn behind it). */
export const CAPTION_ON_SURFACE =
  "[&_figcaption]:rounded-md [&_figcaption]:bg-surface [&_figcaption]:px-2 [&_figcaption]:py-0.5";
