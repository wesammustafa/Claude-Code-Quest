// Whether the room's Pip is in the camera's view (the warm workshop, D8):
// while the Scene holds Pip, the director hears when he walks out of the
// frame and back, so no Reaction plays where no one sees it. Read from the
// anchor the renderer publishes for his head each frame. No 3D code here.
import { useContext, useEffect } from "react";
import type { DirectorInput } from "../../pip/director";
import { usePipInput } from "../../pip/PipStage";
import { SceneContext, type SceneHub } from "../context";
import { workshopOf, type Workshop } from "./store";

/**
 * Tells `send` each time the room's Pip comes into the frame or leaves it
 * while the Scene holds Pip, until the returned stop. Only a change of his
 * own anchor counts: the hold itself tells the director he is seen
 * (useScenePip), and an anchor left from before the hold, or the room's
 * anchors moving round it, tells nothing.
 */
export function followPipInView(
  hub: SceneHub,
  workshop: Workshop,
  send: (input: DirectorInput) => void,
): () => void {
  let last = workshop.anchors().pip?.visible ?? null;
  const heard = () => {
    const now = workshop.anchors().pip?.visible ?? null;
    if (now === last) return;
    last = now;
    if (now !== null && hub.holdsPip())
      send({ type: "onScreen", visible: now });
  };
  const stopAnchors = workshop.subscribeAnchors(heard);
  // A new hold starts from what his anchor says then.
  const stopHold = hub.subscribe(() => {
    last = workshop.anchors().pip?.visible ?? null;
  });
  return () => {
    stopAnchors();
    stopHold();
  };
}

/** Keeps the director told whether the room's Pip is in the camera's view. */
export function usePipInView(): void {
  const hub = useContext(SceneContext);
  const send = usePipInput();
  useEffect(() => followPipInView(hub, workshopOf(hub), send), [hub, send]);
}
