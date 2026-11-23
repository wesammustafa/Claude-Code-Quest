// Seam S13's switch: the mount's `scene.pip` tells the Scene's renderer to
// draw the 3D Pip; absent, as before it, the renderer is told not to, and
// the screens keep their own Pip. The renderer here is a stand-in: jsdom has
// no WebGL, and the real one is e2e's.
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { overview, snapshotOf } from "../../e2e/snapshots";
import { renderMounted } from "../../test/mounted";
import type { SceneMount, SceneProps } from "../mount/types";
import { resetTierProbes } from "./tier";

const LOOK = {
  light: {
    sky: "#fbf6ef",
    ground: "#f0e5d5",
    light: "#fff6ee",
    ambient: 2.9,
    key: 1,
  },
  dark: {
    sky: "#0b1020",
    ground: "#1f2a4d",
    light: "#ffd9c9",
    ambient: 2.6,
    key: 2.4,
  },
};

beforeEach(() => {
  resetTierProbes();
  // A page that gives WebGL2, as a browser with a GPU does.
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    // A constructor the page can name; the probe never calls it.
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: () => undefined }),
  } as unknown as RenderingContext);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function told(pip: boolean | undefined): SceneProps[] {
  const heard: SceneProps[] = [];
  const scene: SceneMount = {
    load: () =>
      Promise.resolve({
        default: (props: SceneProps) => {
          heard.push(props);
          return null;
        },
      }),
    look: LOOK,
    ...(pip === undefined ? {} : { pip }),
  };
  renderMounted("/journey/", snapshotOf(overview), { scene });
  return heard;
}

test("the mount's pip reaches the renderer", async () => {
  const heard = told(true);
  await waitFor(() => {
    expect(heard.at(-1)?.pip).toBe(true);
  });
});

test("without it the renderer draws no Pip of its own", async () => {
  const heard = told(undefined);
  await waitFor(() => {
    expect(heard.length).toBeGreaterThan(0);
  });
  expect(heard.every((props) => props.pip === false)).toBe(true);
});
