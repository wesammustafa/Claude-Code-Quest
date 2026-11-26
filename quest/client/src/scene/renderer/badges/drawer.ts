// The Scene's 3D Badges as Three.js draws them (09 9.3, ticket 53): each
// Badge a screen put on the stage, drawn where its HTML Badge stands and at
// its size, in front of the camera so a camera move never leaves it behind.
// A reveal plays its lights and forms the Badge; a formed one fades in with
// its screen, turns as the Learner turns it on the Badge shelf, and fades
// out with its screen. It marks each HTML Badge it draws
// (`data-scene-drawn`, with the lights and the turn it drew) for the e2e
// checks to read, and `data-scene-shown` once the 3D Badge shows in full,
// which is when the SVG it stands in for steps aside.
import type { RootState } from "@react-three/fiber";
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type Camera,
  type PerspectiveCamera,
} from "three";
import { badgeModel } from "../../badge-art";
import { tokenMs, type BadgeSlot, type BadgeStage } from "../../badges";
import { badgeGeometry, type BadgeGeometry } from "./geometry";
import { revealPose } from "./reveal";

/**
 * How far in front of the camera the Badges stand, in scene units: nearer
 * than any ground can come, so a Badge is never cut by the place behind it.
 */
const DEPTH = 1;
/** How quickly a turn eases to the angle asked for, per second. */
const TURN_RATE = 12;
/** A turn this close to the angle asked for has arrived, in radians. */
const ARRIVED = 0.001;
/** A light's size and its halo's, in Badge widths. */
const LIGHT = 0.05;
const HALO = 2.6;
const HALO_OPACITY = 0.3;

// One geometry per Lesson, earned or not, and size: the symbol's stroke follows the size.
const geometries = new Map<string, BadgeGeometry | null>();

function geometryFor(slot: BadgeSlot): BadgeGeometry | null {
  const key = `${slot.lesson} ${String(slot.earned)} ${slot.size}`;
  if (!geometries.has(key)) {
    const model = badgeModel(slot.lesson, slot.size);
    geometries.set(
      key,
      model === undefined ? null : badgeGeometry(model, slot.earned),
    );
  }
  return geometries.get(key) ?? null;
}

const lightGeometry = new SphereGeometry(1, 16, 12);

/**
 * How far in front of the camera a surface behind the Badges stands: just
 * behind them, so every Badge, turned or revealing, stays in front of it.
 */
const SURFACE_DEPTH = DEPTH * 1.05;

/** The Badges' colours, read from the theme's tokens as the SVG Badges take them, and the page's surface. */
interface Colours {
  earned: Color;
  ink: Color;
  outline: Color;
  light: Color;
  surface: Color;
}

function colours(): Colours {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => new Color(style.getPropertyValue(name).trim());
  return {
    earned: read("--color-accent-mark"),
    ink: read("--color-accent-ink"),
    outline: read("--color-mark"),
    light: read("--color-accent-hover"),
    surface: read("--color-surface"),
  };
}

/** A surface as drawn: its mesh, and the size its rounded box was cut at, in CSS pixels. */
interface DrawnSurface {
  mesh: Mesh<ShapeGeometry, MeshBasicMaterial>;
  cut: string;
}

/** A box `width` by `height` with corners of `radius`, centred on the origin. */
function roundedBox(width: number, height: number, radius: number): Shape {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * A surface the stage asks for: opaque and nearer than anything in the
 * room, it hides the room drawn before it and, by its depth, all the room
 * draws after it, Pip and his shadow too, as the page's own card would;
 * the Badges, nearer still, stand on it. A mesh that skipped the depth
 * test would write no depth either, and let the room's later draws show.
 */
function makeSurface(colour: Color): DrawnSurface {
  const mesh = new Mesh(
    new ShapeGeometry(roundedBox(1, 1, 0)),
    new MeshBasicMaterial({ color: colour, fog: false }),
  );
  return { mesh, cut: "" };
}

/** One slot as drawn: its meshes, and where it stood last. */
interface Drawn {
  slot: BadgeSlot;
  /** Placed at the HTML Badge's box; `spin` turns inside it. */
  place: Group;
  spin: Group;
  body: Mesh<BadgeGeometry["art"], MeshStandardMaterial> | null;
  art: Mesh<BadgeGeometry["art"], MeshBasicMaterial>[];
  lights: { core: Mesh; halo: Mesh }[];
  angle: number;
  /** When it came, and when its slot went (it fades out from there). */
  came: number;
  went: number | null;
  /** The HTML Badge's box when last seen, in CSS pixels. */
  box: { x: number; y: number; size: number } | null;
}

function make(
  slot: BadgeSlot,
  geometry: BadgeGeometry,
  now: number,
  c: Colours,
): Drawn {
  const place = new Group();
  const spin = new Group();
  place.add(spin);
  let body: Drawn["body"] = null;
  if (geometry.body !== null) {
    body = new Mesh(
      geometry.body,
      new MeshStandardMaterial({
        color: c.earned,
        emissive: c.earned,
        emissiveIntensity: 0,
        roughness: 0.55,
        metalness: 0,
        transparent: true,
        fog: false,
      }),
    );
    spin.add(body);
  }
  const artMaterial = new MeshBasicMaterial({
    color: slot.earned ? c.ink : c.outline,
    side: DoubleSide,
    transparent: true,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const front = new Mesh(geometry.art, artMaterial);
  front.position.z = geometry.face;
  spin.add(front);
  const art = [front];
  if (geometry.body !== null) {
    // The back face carries the art too, turned so it reads from behind.
    const back = new Mesh(geometry.art, artMaterial);
    back.rotation.y = Math.PI;
    back.position.z = -geometry.face;
    spin.add(back);
    art.push(back);
  }
  return {
    slot,
    place,
    spin,
    body,
    art,
    lights: [],
    angle: slot.turn,
    came: now,
    went: null,
    box: null,
  };
}

/** A reveal's lights, made once it starts: one for each passed Check line. */
function light(d: Drawn, n: number, c: Colours): void {
  for (let i = d.lights.length; i < n; i++) {
    const core = new Mesh(
      lightGeometry,
      new MeshBasicMaterial({ color: c.light, transparent: true, fog: false }),
    );
    const halo = new Mesh(
      lightGeometry,
      new MeshBasicMaterial({
        color: c.earned,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    core.visible = false;
    halo.visible = false;
    d.place.add(core, halo);
    d.lights.push({ core, halo });
  }
  d.slot.element.setAttribute("data-scene-lights", String(d.lights.length));
}

/**
 * Whether a Badge's box lies wholly inside the screen panel it scrolls in
 * (a Scene screen's panel scrolls in itself): the 3D Badge stands over the
 * room, outside the panel's clip, so one scrolled even partly out of the
 * panel is not drawn, and its SVG, which the panel cuts, shows instead.
 */
function unclipped(box: DOMRect, element: Element): boolean {
  const panel = element.closest("[data-scene-panel]");
  if (panel === null) return true;
  const clip = panel.getBoundingClientRect();
  return (
    box.top >= clip.top &&
    box.bottom <= clip.bottom &&
    box.left >= clip.left &&
    box.right <= clip.right
  );
}

function dispose(d: Drawn): void {
  d.body?.material.dispose();
  d.art[0]?.material.dispose();
  for (const { core, halo } of d.lights) {
    (core.material as MeshBasicMaterial).dispose();
    (halo.material as MeshBasicMaterial).dispose();
  }
  d.place.removeFromParent();
  const el = d.slot.element;
  el.removeAttribute("data-scene-drawn");
  el.removeAttribute("data-scene-shown");
  el.removeAttribute("data-scene-lights");
  el.removeAttribute("data-scene-turn");
}

function recolour(d: Drawn, c: Colours): void {
  d.body?.material.color.copy(c.earned);
  d.body?.material.emissive.copy(c.earned);
  d.art[0]?.material.color.copy(d.slot.earned ? c.ink : c.outline);
  for (const { core, halo } of d.lights) {
    (core.material as MeshBasicMaterial).color.copy(c.light);
    (halo.material as MeshBasicMaterial).color.copy(c.earned);
  }
}

const isPerspective = (camera: Camera): camera is PerspectiveCamera =>
  (camera as PerspectiveCamera).isPerspectiveCamera;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Whether the Scene's canvas shows in full: no box between it and the
 * Scene's layer is part way through a fade (the layer fades the renderer
 * in after its first frame).
 */
export function layerShown(canvas: Element): boolean {
  for (
    let el = canvas.parentElement;
    el !== null && !el.hasAttribute("data-scene");
    el = el.parentElement
  )
    if (Number(getComputedStyle(el).opacity) < 1) return false;
  return true;
}

/** Draws the stage's Badges, frame by frame, into its own group of the Scene. */
export class BadgeDrawer {
  /** The group the Badges stand in, kept where the camera is. */
  readonly rig = new Group();
  private readonly drawn = new Map<BadgeSlot, Drawn>();
  private readonly surfaces = new Map<Element, DrawnSurface>();
  private palette: Colours;
  private readonly stage: BadgeStage;

  constructor(stage: BadgeStage) {
    this.stage = stage;
    this.rig.matrixAutoUpdate = false;
    this.palette = colours();
  }

  /** Takes the theme's colours again. */
  recolour(): void {
    this.palette = colours();
    for (const d of this.drawn.values()) recolour(d, this.palette);
    for (const { mesh } of this.surfaces.values())
      mesh.material.color.copy(this.palette.surface);
  }

  dispose(): void {
    for (const d of this.drawn.values()) dispose(d);
    this.drawn.clear();
    for (const element of [...this.surfaces.keys()]) this.dropSurface(element);
  }

  private dropSurface(element: Element): void {
    const surface = this.surfaces.get(element);
    if (surface === undefined) return;
    surface.mesh.geometry.dispose();
    surface.mesh.material.dispose();
    surface.mesh.removeFromParent();
    this.surfaces.delete(element);
  }

  /** Draws each surface the stage asks for over its element's box, at SURFACE_DEPTH. */
  private drawSurfaces(
    view: DOMRect,
    toView: (x: number, y: number, depth: number) => [number, number],
    perPx: number,
  ): void {
    const asked = new Set(this.stage.surfaces());
    for (const element of [...this.surfaces.keys()])
      if (!asked.has(element)) this.dropSurface(element);
    for (const element of asked) {
      let surface = this.surfaces.get(element);
      if (surface === undefined) {
        surface = makeSurface(this.palette.surface);
        this.rig.add(surface.mesh);
        this.surfaces.set(element, surface);
      }
      const box = element.getBoundingClientRect();
      const { mesh } = surface;
      mesh.visible = box.width > 0 && box.height > 0;
      if (!mesh.visible) continue;
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius);
      const cut = `${box.width.toFixed(1)} ${box.height.toFixed(1)} ${String(radius)}`;
      if (cut !== surface.cut) {
        mesh.geometry.dispose();
        mesh.geometry = new ShapeGeometry(
          roundedBox(box.width, box.height, Number.isNaN(radius) ? 0 : radius),
          8,
        );
        surface.cut = cut;
      }
      const [x, y] = toView(
        box.left + box.width / 2 - view.left,
        box.top + box.height / 2 - view.top,
        SURFACE_DEPTH,
      );
      mesh.position.set(x, y, -SURFACE_DEPTH);
      mesh.scale.setScalar((perPx * SURFACE_DEPTH) / DEPTH);
    }
  }

  /** Draws one frame's Badges; true while something still moves, so a phone asks for the next frame. */
  frame(state: RootState, delta: number): boolean {
    const { camera, gl } = state;
    if (!isPerspective(camera)) return false;
    camera.updateMatrixWorld();
    this.rig.matrix.copy(camera.matrixWorld);
    this.rig.matrixWorldNeedsUpdate = true;
    const now = performance.now();
    const view = gl.domElement.getBoundingClientRect();
    if (view.height <= 0) return false;
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * DEPTH;
    const halfW = halfH * camera.aspect;
    // A camera framing beside a screen's panel draws part of a larger view
    // (setViewOffset): a point of the page lies that far across and down in
    // the whole view, so each Badge still stands on its HTML Badge.
    const part = camera.view?.enabled === true ? camera.view : null;
    const across = (x: number) =>
      part === null
        ? x / view.width
        : (part.offsetX + (x / view.width) * part.width) / part.fullWidth;
    const down = (y: number) =>
      part === null
        ? y / view.height
        : (part.offsetY + (y / view.height) * part.height) / part.fullHeight;
    const perPx =
      ((2 * halfH) / view.height) *
      (part === null ? 1 : part.height / part.fullHeight);
    this.drawSurfaces(
      view,
      (x, y, depth) => [
        (across(x) * 2 * halfW - halfW) * (depth / DEPTH),
        (halfH - down(y) * 2 * halfH) * (depth / DEPTH),
      ],
      perPx,
    );
    const enter = tokenMs("--duration-base");
    const leave = tokenMs("--duration-fast");
    let moving = false;

    const live = new Set(this.stage.slots());
    for (const slot of live) {
      if (this.drawn.has(slot)) continue;
      const geometry = geometryFor(slot);
      if (geometry === null) continue;
      const d = make(slot, geometry, now, this.palette);
      this.rig.add(d.place);
      this.drawn.set(slot, d);
      slot.element.setAttribute(
        "data-scene-drawn",
        slot.earned ? "solid" : "outline",
      );
    }

    for (const [slot, d] of this.drawn) {
      if (!live.has(slot) && d.went === null) d.went = now;
      if (d.went === null) {
        const box = slot.element.getBoundingClientRect();
        d.box =
          box.height > 0 && unclipped(box, slot.element)
            ? {
                x: box.left + box.width / 2 - view.left,
                y: box.top + box.height / 2 - view.top,
                size: box.height,
              }
            : null;
      }
      const out =
        d.went === null ? 1 : 1 - clamp(leave > 0 ? (now - d.went) / leave : 1);
      if (out <= 0) {
        dispose(d);
        this.drawn.delete(slot);
        continue;
      }
      if (d.box === null) {
        d.place.visible = false;
        // The SVG shows instead, cut where its panel cuts it.
        slot.element.removeAttribute("data-scene-shown");
        continue;
      }
      d.place.visible = true;

      // The reveal's pose, or the formed Badge's.
      const reveal = slot.reveal;
      const playing = reveal !== null && !reveal.done;
      if (playing && d.lights.length < reveal.lights)
        light(d, reveal.lights, this.palette);
      const p = playing
        ? clamp((now - reveal.startedAt) / Math.max(1, reveal.ms))
        : 1;
      const pose = revealPose(p, d.lights.length);
      const into =
        reveal !== null ? 1 : clamp(enter > 0 ? (now - d.came) / enter : 1);
      const shown = out * into;
      if (playing || into < 1 || d.went !== null) moving = true;
      // A reveal's own start hides the SVG at once; a formed Badge only once
      // it has faded in, so the SVG never goes before it is replaced.
      if (shown >= 1 && !slot.element.hasAttribute("data-scene-shown"))
        slot.element.setAttribute("data-scene-shown", "");

      d.place.position.set(
        across(d.box.x) * 2 * halfW - halfW,
        halfH - down(d.box.y) * 2 * halfH,
        -DEPTH,
      );
      d.place.scale.setScalar(d.box.size * perPx);

      const want = slot.turn;
      d.angle += (want - d.angle) * (1 - Math.exp(-delta * TURN_RATE));
      if (Math.abs(want - d.angle) < ARRIVED) d.angle = want;
      else moving = true;
      d.spin.rotation.y = d.angle + pose.spin;
      d.spin.scale.setScalar(pose.scale);
      if (d.body !== null) {
        d.body.material.opacity = shown * pose.body;
        d.body.material.emissiveIntensity = pose.glow;
      }
      const art = d.art[0];
      if (art !== undefined)
        art.material.opacity = shown * (d.body === null ? 1 : pose.art);
      d.lights.forEach(({ core, halo }, i) => {
        const light = pose.lights[i];
        const visible = light !== undefined && light.opacity > 0;
        core.visible = visible;
        halo.visible = visible;
        if (light === undefined || !visible) return;
        core.position.set(light.x, light.y, light.z);
        halo.position.copy(core.position);
        core.scale.setScalar(LIGHT * light.size);
        halo.scale.setScalar(LIGHT * light.size * HALO);
        (core.material as MeshBasicMaterial).opacity = shown * light.opacity;
        (halo.material as MeshBasicMaterial).opacity =
          shown * light.opacity * HALO_OPACITY;
      });
      const turned = String(Math.round((d.angle * 180) / Math.PI));
      if (slot.element.getAttribute("data-scene-turn") !== turned)
        slot.element.setAttribute("data-scene-turn", turned);
    }
    return moving;
  }
}
