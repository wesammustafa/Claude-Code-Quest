// The 3D Badge takes over from its SVG only once it can be seen (09 9.3,
// ticket 53): the SVG steps aside (`data-scene-shown`) when the 3D Badge
// has faded in, at once for a reveal, which plays from its own start, and
// the Scene's Badges count as drawn only once the Scene's layer has faded
// its renderer in. Until then the SVG shows as ever.
import type { RootState } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createBadgeStage, type BadgeSlot } from "../../badges";
import { BadgeDrawer, layerShown } from "./drawer";

const root = document.documentElement;
let now = 0;

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  root.style.setProperty("--duration-base", "240ms");
  root.style.setProperty("--duration-fast", "160ms");
});

afterEach(() => {
  vi.restoreAllMocks();
  root.removeAttribute("style");
  document.body.replaceChildren();
});

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** A frame's state as the drawer reads it: the camera and the canvas. */
function stateOf(): RootState {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => rect(0, 0, 800, 600);
  const camera = new PerspectiveCamera(45, 800 / 600, 0.1, 100);
  return { camera, gl: { domElement: canvas } } as unknown as RootState;
}

function badgeArt(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.getBoundingClientRect = () => rect(100, 100, 96, 96);
  document.body.append(svg);
  return svg;
}

function slotOf(
  element: Element,
  reveal: BadgeSlot["reveal"] = null,
): BadgeSlot {
  return { lesson: "b-1", earned: true, size: "lg", element, turn: 0, reveal };
}

describe("the SVG steps aside only once its 3D Badge shows", () => {
  test("a formed Badge: once it has faded in, and back when it is gone", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const state = stateOf();
    const svg = badgeArt();
    stage.add(slotOf(svg));
    drawer.frame(state, 0.016);
    expect(svg).toHaveAttribute("data-scene-drawn", "solid");
    expect(svg).not.toHaveAttribute("data-scene-shown");
    now += 120;
    drawer.frame(state, 0.016);
    expect(svg).not.toHaveAttribute("data-scene-shown");
    now += 120;
    drawer.frame(state, 0.016);
    expect(svg).toHaveAttribute("data-scene-shown");
    drawer.dispose();
    expect(svg).not.toHaveAttribute("data-scene-drawn");
    expect(svg).not.toHaveAttribute("data-scene-shown");
  });

  test("a reveal: at once, since it plays from its own start", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const svg = badgeArt();
    stage.add(
      slotOf(svg, { startedAt: now, ms: 1500, lights: 2, done: false }),
    );
    drawer.frame(stateOf(), 0.016);
    expect(svg).toHaveAttribute("data-scene-shown");
    expect(svg).toHaveAttribute("data-scene-lights", "2");
  });
});

describe("where a Badge stands", () => {
  // Lesson complete frames its place beside the panel its Badge sits in:
  // the camera draws part of a larger view, and the Badge drawn without
  // that shift stood a panel's shift away from its HTML Badge.
  test("on its HTML Badge, under a camera that draws part of a larger view", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const state = stateOf();
    const camera = state.camera as PerspectiveCamera;
    camera.setViewOffset(800, 600, 160, -40, 800, 600);
    camera.updateMatrixWorld();
    stage.add(slotOf(badgeArt()));
    drawer.frame(state, 0.016);
    drawer.rig.updateMatrixWorld(true);
    const badge = drawer.rig.children[0];
    expect(badge).toBeDefined();
    const at = badge?.getWorldPosition(new Vector3()).project(camera);
    // The SVG's centre: 100 + 96 / 2 across and down.
    expect((((at?.x ?? 0) + 1) / 2) * 800).toBeCloseTo(148, 3);
    expect(((1 - (at?.y ?? 0)) / 2) * 600).toBeCloseTo(148, 3);
  });
});

describe("the layer shows its renderer in full", () => {
  function layer(fade: string): HTMLCanvasElement {
    const scene = document.createElement("div");
    scene.setAttribute("data-scene", "");
    const drawn = document.createElement("div");
    drawn.style.opacity = fade;
    const inner = document.createElement("div");
    const canvas = document.createElement("canvas");
    inner.append(canvas);
    drawn.append(inner);
    scene.append(drawn);
    document.body.append(scene);
    return canvas;
  }

  test("not while the renderer fades in", () => {
    expect(layerShown(layer("0"))).toBe(false);
    expect(layerShown(layer("0.53"))).toBe(false);
  });

  test("once it has", () => {
    expect(layerShown(layer("1"))).toBe(true);
  });
});
