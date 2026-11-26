// The room's Pip in the camera's view (the warm workshop, D8): the director
// hears when he leaves the frame and comes back while the Scene holds Pip,
// and nothing else.
import { describe, expect, test } from "vitest";
import type { DirectorInput } from "../../pip/director";
import { createSceneHub } from "../context";
import { followPipInView } from "./seen";
import { createWorkshop } from "./store";

function setup() {
  const hub = createSceneHub();
  const workshop = createWorkshop();
  const told: DirectorInput[] = [];
  const stop = followPipInView(hub, workshop, (input) => told.push(input));
  const head = (visible: boolean, x = 400) => {
    workshop.setAnchors({ ...workshop.anchors(), pip: { x, y: 300, visible } });
  };
  return { hub, workshop, told, stop, head };
}

describe("the room's Pip in view", () => {
  test("while the Scene holds Pip, his leaving the frame and coming back are told", () => {
    const { hub, told, head } = setup();
    // His anchor before he holds Pip: drawn but not shown.
    head(false);
    hub.holdPip();
    head(true);
    head(true, 420);
    head(false, 1600);
    head(true, 500);
    expect(told).toEqual([
      { type: "onScreen", visible: true },
      { type: "onScreen", visible: false },
      { type: "onScreen", visible: true },
    ]);
  });

  test("nothing is told while the Scene does not hold Pip, nor for the room's anchors moving round his", () => {
    const { hub, workshop, told, head } = setup();
    head(true);
    head(false);
    expect(told).toEqual([]);
    hub.holdPip();
    workshop.setAnchors({
      ...workshop.anchors(),
      noticeboard: { x: 10, y: 10, visible: true },
    });
    expect(told).toEqual([]);
  });
});
