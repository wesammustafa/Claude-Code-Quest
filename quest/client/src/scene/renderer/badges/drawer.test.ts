// The 3D Badge takes over from its SVG only once it can be seen (09 9.3,
// ticket 53): the SVG steps aside (`data-scene-shown`) when the 3D Badge
// has faded in, at once for a reveal, which plays from its own start, and
// the Scene's Badges count as drawn only once the Scene's layer has faded
// its renderer in. Until then the SVG shows as ever.
import type { RootState } from "@react-three/fiber";
import {
  PerspectiveCamera,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
  type Object3D,
} from "three";
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

// The Badge shelf has no page surface, so its 3D Badges behind it show:
// U4 left the room showing between them.
describe("a surface behind the Badges", () => {
  function shelf(): HTMLElement {
    const el = document.createElement("section");
    el.getBoundingClientRect = () => rect(50, 80, 400, 200);
    document.body.append(el);
    return el;
  }

  test("fills its element's box behind the Badges in the page's surface colour, keeping the room out, and goes when released", () => {
    root.style.setProperty("--color-surface", "#fdfaf5");
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const state = stateOf();
    const camera = state.camera as PerspectiveCamera;
    const release = stage.addSurface(shelf());
    stage.add(slotOf(badgeArt()));
    drawer.frame(state, 0.016);
    drawer.rig.updateMatrixWorld(true);
    const [surface, badge] = drawer.rig.children as Mesh[];
    if (surface === undefined || badge === undefined)
      throw new Error("nothing drawn");
    const material = surface.material as MeshBasicMaterial;
    expect(`#${material.color.getHexString()}`).toBe("#fdfaf5");
    // Depth-tested, so it writes its depth and hides what the room draws after it.
    expect(material.depthTest).toBe(true);
    expect(material.depthWrite).toBe(true);
    expect(material.transparent).toBe(false);
    // Its box, corner to corner, on the page.
    surface.geometry.computeBoundingBox();
    const box = surface.geometry.boundingBox;
    const page = (p: Vector3) => {
      const v = surface.localToWorld(p).project(camera);
      return [((v.x + 1) / 2) * 800, ((1 - v.y) / 2) * 600];
    };
    const [left, top] = page(new Vector3(box?.min.x, box?.max.y, 0));
    const [right, bottom] = page(new Vector3(box?.max.x, box?.min.y, 0));
    expect(left).toBeCloseTo(50, 3);
    expect(top).toBeCloseTo(80, 3);
    expect(right).toBeCloseTo(450, 3);
    expect(bottom).toBeCloseTo(280, 3);
    // Behind the Badge, which stands in front of it.
    const depth = (o: Object3D) =>
      o.getWorldPosition(new Vector3()).distanceTo(camera.position);
    expect(depth(surface)).toBeGreaterThan(depth(badge));
    release();
    drawer.frame(state, 0.016);
    expect(drawer.rig.children).not.toContain(surface);
  });

  test("is not drawn while its element has no box", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const el = shelf();
    el.getBoundingClientRect = () => rect(0, 0, 0, 0);
    stage.addSurface(el);
    drawer.frame(stateOf(), 0.016);
    expect(drawer.rig.children[0]?.visible).toBe(false);
  });
});

describe("a Badge in a panel that scrolls in itself", () => {
  // On a phone the Lesson complete sheet scrolls: a Badge drawn from its
  // box alone followed it past the sheet's top and over the room.
  function inPanel(top: number): SVGSVGElement {
    const panel = document.createElement("div");
    panel.setAttribute("data-scene-panel", "");
    panel.getBoundingClientRect = () => rect(0, 300, 800, 300);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.getBoundingClientRect = () => rect(100, top, 96, 96);
    panel.append(svg);
    document.body.append(panel);
    return svg;
  }

  test("is drawn while its box lies inside the panel", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const svg = inPanel(400);
    stage.add(
      slotOf(svg, { startedAt: now, ms: 1500, lights: 2, done: false }),
    );
    drawer.frame(stateOf(), 0.016);
    expect(drawer.rig.children[0]?.visible).toBe(true);
    expect(svg).toHaveAttribute("data-scene-shown");
  });

  test("is not drawn once scrolled even partly out of it, and its SVG shows again", () => {
    const stage = createBadgeStage();
    const drawer = new BadgeDrawer(stage);
    const svg = inPanel(400);
    stage.add(
      slotOf(svg, { startedAt: now, ms: 1500, lights: 2, done: false }),
    );
    const state = stateOf();
    drawer.frame(state, 0.016);
    svg.getBoundingClientRect = () => rect(100, 260, 96, 96);
    drawer.frame(state, 0.016);
    expect(drawer.rig.children[0]?.visible).toBe(false);
    expect(svg).not.toHaveAttribute("data-scene-shown");
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
