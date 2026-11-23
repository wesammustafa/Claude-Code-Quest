// The 3D Pip's ground shadow (seam S13): the soft ellipse every poster and
// the rig (pip.rml's Shadow) stand Pip on, so he stands rather than floats
// in his box. It lies in Pip's own camera-facing plane, as the rig draws
// it, never as a floor disc seen edge-on: just behind his soles, so they
// overlap its upper half. It is the renderer's, not the model's, so it
// never counts in his measured height. Pure three.js, with no WebGL.
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
} from "three";
import type { SceneTheme } from "../../../mount/types";

/** Where the shadow sits and how it looks, in the model's units (Pip is about one tall, soles at 0, facing +z). */
export const SHADOW = {
  /**
   * Its centre: on the soles' line, just behind the feet's backs (z -0.069).
   * Any further back and the lens's perspective lifts it behind his feet,
   * so the part below his soles, the part that stands him, would vanish;
   * it sits a hair below the soles for the lift that remains.
   */
  y: -0.004,
  z: -0.08,
  /** Half its width and height: the rig's 460-unit circle squashed to 0.11. */
  halfWidth: 230 / 725,
  halfHeight: (230 * 0.11) / 725,
  colour: "#3A1A10",
  /**
   * Its strongest opacity on each sky: on the light one, as dark under his
   * soles as the posters' 28% black reads on the page.
   */
  opacity: { light: 0.3, dark: 0.4 } satisfies Record<SceneTheme, number>,
  /** How much wider it lies under him asleep, as the rig's does. */
  sleepWidth: 1.15,
  /** How fast it shrinks and fades as a hop lifts him: by 1 - lift x Hop's height. */
  lift: 1.5,
} as const;

/** The rig's radial gradient (pip.rml's Shadow Shape), normalised: the share of full alpha at each radius. */
const FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.55, 0x2a / 0x47],
  [1, 0],
];
const RINGS = [0.2, 0.4, 0.55, 0.7, 0.85, 1];
const SEGMENTS = 32;

const alphaAt = (r: number): number => {
  for (let i = 0; i + 1 < FALLOFF.length; i++) {
    const [r0, a0] = FALLOFF[i] ?? [0, 1];
    const [r1, a1] = FALLOFF[i + 1] ?? [1, 0];
    if (r <= r1) return a0 + ((a1 - a0) * (r - r0)) / (r1 - r0);
  }
  return 0;
};

/** The shadow's mesh: a unit-radius disc of rings, its alpha in its vertex colours, laid on Pip's camera-facing plane. */
export function shadowMesh(theme: SceneTheme): Mesh {
  const positions: number[] = [0, 0, 0];
  const colours: number[] = [1, 1, 1, alphaAt(0)];
  for (const r of RINGS)
    for (let s = 0; s < SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      positions.push(r * Math.cos(a), r * Math.sin(a), 0);
      colours.push(1, 1, 1, alphaAt(r));
    }
  const index: number[] = [];
  const at = (ring: number, s: number) => 1 + ring * SEGMENTS + (s % SEGMENTS);
  for (let s = 0; s < SEGMENTS; s++) index.push(0, at(0, s), at(0, s + 1));
  for (let ring = 0; ring + 1 < RINGS.length; ring++)
    for (let s = 0; s < SEGMENTS; s++) {
      const a = at(ring, s);
      const b = at(ring, s + 1);
      const c = at(ring + 1, s + 1);
      const d = at(ring + 1, s);
      index.push(a, d, c, a, c, b);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colours, 4));
  geometry.setIndex(index);
  const material = new MeshBasicMaterial({
    color: new Color(SHADOW.colour),
    vertexColors: true,
    transparent: true,
    opacity: SHADOW.opacity[theme],
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "PipShadow";
  // Before Pip, though as a transparent mesh it draws after his opaque parts.
  mesh.renderOrder = -1;
  mesh.position.set(0, SHADOW.y, SHADOW.z);
  mesh.scale.set(SHADOW.halfWidth, SHADOW.halfHeight, 1);
  return mesh;
}

/**
 * Poses the shadow for this frame: wider by the sleep mode's share, and
 * smaller and fainter as Hop lifts him (`lift`, Hop's height in the
 * model's units), so it shrinks under a Celebration's or Greeting's hop.
 */
export function poseShadow(
  shadow: Mesh,
  o: { lift: number; sleep: number; theme: SceneTheme },
): void {
  const under = Math.max(0, Math.min(1, 1 - SHADOW.lift * Math.max(0, o.lift)));
  const wide = 1 + (SHADOW.sleepWidth - 1) * Math.max(0, Math.min(1, o.sleep));
  shadow.scale.set(
    SHADOW.halfWidth * wide * under,
    SHADOW.halfHeight * under,
    1,
  );
  const material = shadow.material as MeshBasicMaterial;
  material.opacity = SHADOW.opacity[o.theme] * under;
  shadow.visible = under > 0;
}
