// A Scene screen's panel keeps its foot below the part that scrolls, so no
// word the panel scrolls is ever under it; without the Scene the foot is
// the column's last row, as before.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MountContext, type MountValue } from "../mount/context";
import type { SceneMount } from "../mount/types";
import { MomentMain, PanelMain } from "./OverScene";

const OVER_SCENE: MountValue = {
  router: "hash",
  live: null,
  slots: {},
  transitions: null,
  scene: {} as SceneMount,
};

const panel = (
  <PanelMain column="column" panel="" foot={<div data-foot="">Start</div>}>
    <p>Why</p>
  </PanelMain>
);

describe("PanelMain's foot", () => {
  test("over the Scene, the foot follows the scrolling part, outside it", () => {
    const { container } = render(
      <MountContext.Provider value={OVER_SCENE}>{panel}</MountContext.Provider>,
    );
    const body = container.querySelector("[data-scene-panel]");
    const foot = container.querySelector("[data-foot]");
    expect(body?.textContent).toBe("Why");
    expect(body?.contains(foot)).toBe(false);
    expect(body?.nextElementSibling).toBe(foot);
  });

  test("without the Scene, the foot is the column's last row and there is no panel", () => {
    const { container } = render(panel);
    const main = container.querySelector("main");
    expect(container.querySelector("[data-scene-panel]")).toBeNull();
    expect(main?.lastElementChild?.hasAttribute("data-foot")).toBe(true);
  });
});

test("MomentMain passes its attributes to its main", () => {
  const { container } = render(
    <MomentMain data-signed-in="failed">
      <p>Sign in</p>
    </MomentMain>,
  );
  expect(container.querySelector("main")?.dataset["signedIn"]).toBe("failed");
});
