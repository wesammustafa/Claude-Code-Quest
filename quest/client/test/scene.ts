// A Scene for the tests to mount: the host's look, every colour the
// renderer asks for, and a page whose tier draws (WebGL2 there), so a
// stand-in renderer loads as the real one would. jsdom has no WebGL.
import { vi } from "vitest";
import type { SceneMount } from "../src/mount/types";
import { resetTierProbes } from "../src/scene/tier";

export const LOOK: SceneMount["look"] = {
  light: {
    sky: "#fbf6ef",
    ground: "#f0e5d5",
    light: "#fff6ee",
    ambient: 2.9,
    key: 1,
    shadow: "#3a1a10",
    workshop: {
      ambient: 2,
      key: 1.5,
      lamp: 0.4,
      floor: "#d8b48a",
      wall: "#f3e5d0",
      wood: "#b07a46",
      fabric: "#c86b5a",
      teal: "#2f6f68",
      leaf: "#8fb87a",
      window: "#fff1cf",
      glow: "#fff2c8",
      paper: "#fffdf8",
      ink: "#3b4256",
      done: "#e3f3e6",
      optional: "#e6f0fb",
      next: "#ff784e",
    },
  },
  dark: {
    sky: "#0b1020",
    ground: "#1f2a4d",
    light: "#ffd9c9",
    ambient: 2.6,
    key: 2.4,
    shadow: "#3a1a10",
    workshop: {
      ambient: 1.1,
      key: 0.6,
      lamp: 3,
      floor: "#6b4f3a",
      wall: "#4a4152",
      wood: "#7a5236",
      fabric: "#8f4a3f",
      teal: "#2f5f5c",
      leaf: "#4f6e48",
      window: "#1b2547",
      glow: "#ffd9a0",
      paper: "#f3ead9",
      ink: "#2b2f45",
      done: "#cfe9d4",
      optional: "#d6e3f5",
      next: "#ff8a5c",
    },
  },
};
/** A page that gives WebGL2, as a browser with a GPU does; vi.restoreAllMocks and vi.unstubAllGlobals undo it. */
export function drawingTier(): void {
  resetTierProbes();
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    // A constructor the page can name; the probe never calls it.
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: () => undefined }),
  } as unknown as RenderingContext);
}
