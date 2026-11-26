// The screens over the running Scene (the warm workshop): no page text sits
// on the room itself, only on opaque surfaces. A Lesson's screens put their
// words in a panel beside the room, or under it on a narrow page, where the
// camera leaves the room its share; a moment's screens put theirs in one
// card. Without the Scene each screen keeps its own column, as before.
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../lib/cx";
import { useMount } from "../mount/context";
import {
  MOMENT,
  SCENE_PANEL,
  SCENE_PANEL_BODY,
  SCENE_STAGE,
  SURFACE,
} from "./layout";

/** Whether the screens stand over the Scene: the mount turned it on. */
export function useOverScene(): boolean {
  return useMount().scene !== null;
}

type MainProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  /** The screen's own column, without the Scene. */
  column: string;
  /** The look of the panel's scrolling part over the Scene: a surface, or none where its parts bring their own. */
  panel: string;
  /** The look of the whole panel over the Scene, round its scrolling part and its foot. */
  frame?: string;
  /** What stays in view below the scrolling part over the Scene; without it, the column's last row. */
  foot?: ReactNode;
  children: ReactNode;
};

/**
 * A Lesson screen's main: its column, or over the Scene the stage with its
 * panel, whose foot sits below the part that scrolls rather than over it,
 * so no word the panel scrolls is ever covered.
 */
export function PanelMain({
  column,
  panel,
  frame,
  foot,
  children,
  ...props
}: MainProps): ReactNode {
  if (!useOverScene())
    return (
      <main className={column} {...props}>
        {children}
        {foot}
      </main>
    );
  return (
    <main className={SCENE_STAGE} {...props}>
      <div className={cx(SCENE_PANEL, frame)}>
        <div data-scene-panel="" className={cx(SCENE_PANEL_BODY, panel)}>
          {children}
        </div>
        {foot}
      </div>
    </main>
  );
}

/** The padding of a panel's scrolling part. */
export const PANEL_PADDING = "p-6 max-sm:p-5";

/** A Lesson screen's panel over the Scene: one surface. */
export const PANEL_SURFACE = cx(SURFACE, PANEL_PADDING);

/**
 * The start buttons at the foot of a panel whose frame is SURFACE (the
 * prototype's foot): below the part that scrolls, a rule above.
 */
export const PANEL_FOOT =
  "shrink-0 rounded-b-xl border-t border-line px-6 py-4 max-sm:px-5";

/**
 * A moment's main (MOMENT): over the Scene its words sit in one card, the
 * screen's stood-down Pip box collapsed in it.
 */
export function MomentMain({
  children,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "className"> & {
  children: ReactNode;
}): ReactNode {
  const over = useOverScene();
  return (
    <main className={MOMENT} {...props}>
      {over ? (
        <div
          data-scene-card=""
          className={cx(
            SURFACE,
            "grid w-full justify-items-center gap-4 p-6 max-sm:p-5 [&>*]:min-w-0 [&_[data-pip-stood-down]]:hidden",
          )}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
}
