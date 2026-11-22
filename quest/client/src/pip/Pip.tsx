import { useCallback, useEffect } from "react";
import type { PipModel } from "../../pip/contract";
import { cx } from "../lib/cx";
import { usePipStandsDown, useSceneHoldsPipNow } from "../scene/context";
import { PipIcon } from "./PipIcon";
import { BOX, PipRenderer } from "./PipRenderer";
import { usePipFollowsPointer, usePipInput, usePipModel } from "./PipStage";

export interface PipProps {
  /** Where the screen puts Pip; `icon` is always the static SVG. */
  size: PipModel["size"];
  className?: string | undefined;
}

/**
 * Pip at one of its sizes. The icon size is always the static icon, 24 px
 * here, and never the rig. The larger sizes draw the page's director's model
 * at the size the screen gives, tell the director when Pip scrolls out of
 * view or leaves the screen, and follow the mouse. While the Scene holds Pip
 * (seam S12) they stand down: Pip's box stays empty, so the screen keeps its
 * layout, and only the Scene's Pip talks to the director.
 */
export function Pip({ size, className }: PipProps) {
  const standsDown = usePipStandsDown();
  if (size === "icon") return <PipIcon className={cx("size-6", className)} />;
  if (standsDown)
    return (
      <span
        data-pip-stood-down={size}
        aria-hidden="true"
        className={cx("relative inline-block shrink-0", BOX[size], className)}
      />
    );
  return <StagedPip size={size} className={className} />;
}

function StagedPip({
  size,
  className,
}: {
  size: Exclude<PipModel["size"], "icon">;
  className: string | undefined;
}) {
  const model = usePipModel();
  const send = usePipInput();
  usePipFollowsPointer();
  const onScreenChange = useCallback(
    (visible: boolean) => {
      send({ type: "onScreen", visible });
    },
    [send],
  );
  // A Pip arriving with its screen is taken as seen until the observer says
  // otherwise, so a screen change never rests Pip for a frame; a Pip that
  // leaves with its screen can no longer be seen, unless it leaves because
  // the Scene now holds Pip, whose own Pip is seen.
  const sceneHoldsPip = useSceneHoldsPipNow();
  useEffect(() => {
    send({ type: "onScreen", visible: true });
    return () => {
      if (!sceneHoldsPip()) send({ type: "onScreen", visible: false });
    };
  }, [send, sceneHoldsPip]);
  return (
    <PipRenderer
      model={{ ...model, size }}
      className={className}
      onScreenChange={onScreenChange}
    />
  );
}
