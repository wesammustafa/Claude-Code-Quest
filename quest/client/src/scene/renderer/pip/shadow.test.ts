// @vitest-environment node
// The 3D Pip's ground shadow (seam S13): a soft ellipse in Pip's own
// camera-facing plane, just behind his soles, darkest at its centre and
// gone at its rim, darker on the dark sky, in the look's colour; wider
// asleep, and smaller and fainter as a hop lifts him.
import {
  Color,
  Vector3,
  type BufferAttribute,
  type MeshBasicMaterial,
} from "three";
import { describe, expect, test } from "vitest";
import { SHADOW, poseShadow, shadowMesh, tintShadow } from "./shadow";

const COLOUR = "#3a1a10";

describe("Pip's ground shadow", () => {
  test("faces the camera as Pip does, behind his soles, fading from its centre to its rim", () => {
    const shadow = shadowMesh("light", COLOUR);
    expect(shadow.position.toArray()).toEqual([0, SHADOW.y, SHADOW.z]);
    expect(shadow.position.z).toBeLessThan(0);
    const material = shadow.material as MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(shadow.renderOrder).toBeLessThan(0);

    const geometry = shadow.geometry;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const colour = geometry.getAttribute("color") as BufferAttribute;
    const index = geometry.getIndex();
    if (index === null) throw new Error("no index");
    // Flat in x-y, every triangle wound to face +z (the camera).
    const at = (i: number) => new Vector3().fromBufferAttribute(position, i);
    for (let i = 0; i < position.count; i++) expect(at(i).z).toBe(0);
    for (let i = 0; i < index.count; i += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => at(index.getX(i + k)));
      if (a === undefined || b === undefined || c === undefined)
        throw new Error("short");
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      expect(normal.z).toBeGreaterThan(0);
    }
    // Full alpha at the centre, none at the rim (radius 1 before its scale).
    for (let i = 0; i < position.count; i++) {
      const r = at(i).length();
      const alpha = colour.getW(i);
      if (r === 0) expect(alpha).toBe(1);
      if (Math.abs(r - 1) < 1e-6) expect(alpha).toBe(0);
    }
  });

  test("lies darker on the dark sky, wider asleep, and shrinks and fades under a hop", () => {
    const shadow = shadowMesh("dark", COLOUR);
    const material = shadow.material as MeshBasicMaterial;
    poseShadow(shadow, { lift: 0, sleep: 0, theme: "dark" });
    expect(material.opacity).toBe(SHADOW.opacity.dark);
    expect(shadow.scale.x).toBeCloseTo(SHADOW.halfWidth, 6);
    poseShadow(shadow, { lift: 0, sleep: 0, theme: "light" });
    expect(material.opacity).toBe(SHADOW.opacity.light);
    expect(SHADOW.opacity.light).toBeLessThan(SHADOW.opacity.dark);

    poseShadow(shadow, { lift: 0, sleep: 1, theme: "light" });
    expect(shadow.scale.x).toBeCloseTo(SHADOW.halfWidth * SHADOW.sleepWidth, 6);
    expect(shadow.scale.y).toBeCloseTo(SHADOW.halfHeight, 6);

    // Celebration's hop peaks near 0.13: the shadow is about 80% as big and as dark.
    poseShadow(shadow, { lift: 0.13, sleep: 0, theme: "light" });
    const under = 1 - SHADOW.lift * 0.13;
    expect(shadow.scale.x).toBeCloseTo(SHADOW.halfWidth * under, 6);
    expect(shadow.scale.y).toBeCloseTo(SHADOW.halfHeight * under, 6);
    expect(material.opacity).toBeCloseTo(SHADOW.opacity.light * under, 6);
    expect(shadow.visible).toBe(true);

    poseShadow(shadow, { lift: 1, sleep: 0, theme: "light" });
    expect(shadow.visible).toBe(false);
  });

  test("takes the look's colour, and the next look's when the theme changes", () => {
    const shadow = shadowMesh("light", COLOUR);
    const material = shadow.material as MeshBasicMaterial;
    expect(material.color.getHexString()).toBe(
      new Color(COLOUR).getHexString(),
    );
    tintShadow(shadow, "#102030");
    expect(material.color.getHexString()).toBe(
      new Color("#102030").getHexString(),
    );
  });
});
