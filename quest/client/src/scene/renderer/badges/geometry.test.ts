// The 3D Badges are made in code from the SVG Badges (09 9.3, ticket 53):
// every Lesson in the course has one, its model is the SVG's own art (the
// Level's shape, a capstone's inner ring, the symbol and its stroke, the
// dashes when unearned), and its meshes are made from that art: the solid
// fills the shape's outline and the raised art stays on the Badge.
import { createElement } from "react";
import { Box3, Vector2, type BufferGeometry } from "three";
import { describe, expect, test } from "vitest";
import { renderWithMotion } from "../../../../test/motion";
import type { BadgeShape, BadgeSize } from "../../../components/Badge";
import { LessonBadge } from "../../../components/badges";
import { badgeModel, type ArtElement } from "../../badge-art";
import {
  BODY_DEPTH,
  badgeGeometry,
  dashed,
  strokeGeometry,
  strokesOf,
} from "./geometry";

const manifestText = import.meta.glob<string>(
  "../../../../../../course/manifest.json",
  { query: "?raw", import: "default", eager: true },
);
const manifest = JSON.parse(Object.values(manifestText)[0] ?? "{}") as {
  lessons: { id: string; level: string }[];
};

/** Each SVG element under `parent`, as the model writes one. */
const elementsIn = (parent: Element | null | undefined): ArtElement[] =>
  [...(parent?.children ?? [])].map((el) => ({
    tag: el.tagName,
    attrs: Object.fromEntries(
      [...el.attributes].map((a) => [a.name, a.value] as const),
    ),
  }));

/** The SVG Badge's parts, as Badge.tsx draws them. */
function svgParts(lesson: string, earned: boolean, size: BadgeSize) {
  const { container, unmount } = renderWithMotion(
    createElement(LessonBadge, {
      lesson,
      name: "Name",
      earned,
      size,
      caption: false,
    }),
  );
  const art = container.querySelector("[data-badge-shape]");
  const groups = [...(art?.children ?? [])];
  const outline = groups[0];
  const ring = groups.find((g) =>
    g.getAttribute("transform")?.includes("scale("),
  );
  const symbol = groups.find((g) =>
    g.getAttribute("transform")?.startsWith("translate(20"),
  );
  const parts = {
    outline: elementsIn(outline),
    dash: outline?.getAttribute("stroke-dasharray") ?? null,
    ring:
      ring === undefined
        ? null
        : Number(
            /scale\(([\d.]+)\)/.exec(ring.getAttribute("transform") ?? "")?.[1],
          ),
    ringArt: elementsIn(ring),
    ringStroke: ring?.getAttribute("stroke-width") ?? null,
    ringDash: ring?.getAttribute("stroke-dasharray") ?? null,
    symbol: elementsIn(symbol),
    symbolAt: /translate\(([\d.]+) ([\d.]+)\)/
      .exec(symbol?.getAttribute("transform") ?? "")
      ?.slice(1)
      .map(Number),
    symbolStroke: Number(symbol?.getAttribute("stroke-width")),
    outlineStroke: Number(
      container.querySelector("svg")?.getAttribute("stroke-width"),
    ),
  };
  unmount();
  return parts;
}

/** Every vertex is a number: a stroke that lost its count draws nothing, or garbage. */
const finite = (geometry: BufferGeometry | null) =>
  Array.from(geometry?.getAttribute("position").array ?? []).every((v) =>
    Number.isFinite(v),
  );

const boxOf = (geometry: BufferGeometry | null) => {
  geometry?.computeBoundingBox();
  return geometry?.boundingBox ?? new Box3();
};

/** The shape's outline on the 64 grid, as Badge.tsx's paths reach it: left, right, top, bottom. */
const OUTLINE: Record<BadgeShape, [number, number, number, number]> = {
  circle: [7, 57, 7, 57],
  hexagon: [10, 54, 6.5, 57.5],
  shield: [11, 53, 6, 58],
};
const inBadge = (v: number) => (v - 32) / 64;
const fail = (id: string): never => {
  throw new Error(`no model for ${id}`);
};
const CLOSE = 0.004;

describe("every Lesson in the course has a 3D Badge made from its SVG", () => {
  test("the course's 23 Lessons each have one", () => {
    expect(manifest.lessons).toHaveLength(23);
    for (const { id } of manifest.lessons)
      expect(badgeModel(id), id).toBeDefined();
  });

  describe.each(manifest.lessons)("$id", ({ id }) => {
    const capstone = id.endsWith("-capstone");

    test.each(["sm", "lg"] as const)(
      "its model is the SVG's shape, ring and symbol at %s",
      (size) => {
        const model = badgeModel(id, size);
        const svg = svgParts(id, true, size);
        expect(model?.capstone).toBe(capstone);
        expect(model?.outline).toEqual(svg.outline);
        expect(model?.outlineStroke).toBe(svg.outlineStroke);
        expect(model?.ring).toBe(svg.ring);
        if (capstone) expect(svg.ringArt).toEqual(svg.outline);
        // The ring inherits the outline's stroke, which its scale scales too.
        expect(svg.ringStroke).toBeNull();
        const [outline, ...rest] = strokesOf(model ?? fail(id), true);
        expect(outline?.width).toBeCloseTo(svg.outlineStroke / 64, 6);
        if (capstone)
          expect(rest[0]?.width).toBeCloseTo(
            (svg.outlineStroke * (svg.ring ?? 0)) / 64,
            6,
          );
        expect(rest.at(-1)?.width).toBeCloseTo(svg.symbolStroke / 64, 6);
        expect(model?.symbol).toEqual(svg.symbol);
        expect(model?.symbol.length).toBeGreaterThan(0);
        expect([model?.symbolAt, model?.symbolAt]).toEqual(svg.symbolAt);
        expect(model?.symbolStroke).toBe(svg.symbolStroke);
        const unearned = svgParts(id, false, size);
        expect(model?.dash.join(" ")).toBe(unearned.dash);
        if (capstone) expect(unearned.ringDash).toBe(unearned.dash);
      },
    );

    test("earned, a solid filling its shape's outline with its art raised on it", () => {
      const model = badgeModel(id);
      if (model === undefined) throw new Error(`no model for ${id}`);
      const { body, art, face } = badgeGeometry(model, true);
      expect(finite(body) && finite(art)).toBe(true);
      const solid = boxOf(body);
      const [left, right, top, bottom] = OUTLINE[model.shape];
      expect(solid.min.x).toBeCloseTo(inBadge(left), 2);
      expect(solid.max.x).toBeCloseTo(inBadge(right), 2);
      expect(solid.max.y).toBeCloseTo(-inBadge(top), 2);
      expect(solid.min.y).toBeCloseTo(-inBadge(bottom), 2);
      expect(solid.max.z).toBeGreaterThan(BODY_DEPTH / 2);
      expect(face).toBeGreaterThan(solid.max.z);
      // The art: the outline's stroke reaches past the solid by half its width, and no further.
      const drawn = boxOf(art);
      const half = model.outlineStroke / 2 / 64;
      expect(drawn.min.x).toBeCloseTo(solid.min.x - half, 2);
      expect(drawn.max.x).toBeCloseTo(solid.max.x + half, 2);
      expect(drawn.max.z - drawn.min.z).toBe(0);
    });

    test("its symbol sits on its 24 grid at the Badge's centre, and a capstone's ring inside the outline", () => {
      const model = badgeModel(id);
      if (model === undefined) throw new Error(`no model for ${id}`);
      const [outline, ...rest] = strokesOf(model, true);
      const symbol = rest.at(-1);
      const ring = rest.length === 2 ? rest[0] : undefined;
      expect(ring !== undefined).toBe(capstone);
      const points = (s: typeof symbol) => s?.runs.flat() ?? [];
      // The 24 grid at (20, 20): a run of the symbol never leaves it.
      for (const p of points(symbol)) {
        expect(p.x).toBeGreaterThanOrEqual(inBadge(20) - CLOSE);
        expect(p.x).toBeLessThanOrEqual(inBadge(44) + CLOSE);
        expect(-p.y).toBeGreaterThanOrEqual(inBadge(20) - CLOSE);
        expect(-p.y).toBeLessThanOrEqual(inBadge(44) + CLOSE);
      }
      // As many runs as the SVG's symbol starts paths.
      expect(symbol?.runs.length).toBeGreaterThanOrEqual(model.symbol.length);
      if (ring !== undefined) {
        const scale = model.ring ?? 0;
        const widest = (s: typeof symbol) =>
          Math.max(...points(s).map((p) => Math.hypot(p.x, p.y)));
        expect(widest(ring)).toBeCloseTo(widest(outline) * scale, 3);
        expect(ring.width).toBeCloseTo((outline?.width ?? 0) * scale, 6);
      }
    });

    test.each([true, false])(
      "each run is stroked on its own, never over another (earned %s)",
      (earned) => {
        const model = badgeModel(id) ?? fail(id);
        const strokes = strokesOf(model, earned);
        const all = Array.from(
          strokeGeometry(strokes).getAttribute("position").array,
        );
        // Each prefix of the strokes draws exactly the triangles it draws alone.
        for (let n = 1; n < strokes.length; n++) {
          const alone = Array.from(
            strokeGeometry(strokes.slice(0, n)).getAttribute("position").array,
          );
          expect(alone.length).toBeGreaterThan(0);
          expect(all.slice(0, alone.length)).toEqual(alone);
        }
        // And the outline's first run, alone, is unchanged by the runs after it.
        const [outline] = strokes;
        const first = outline?.runs[0];
        if (outline === undefined || first === undefined) throw new Error(id);
        const one = Array.from(
          strokeGeometry([
            { runs: [first], width: outline.width },
          ]).getAttribute("position").array,
        );
        expect(all.slice(0, one.length)).toEqual(one);
      },
    );

    test("unearned, outlines alone: no solid, the outline dashed, the symbol whole", () => {
      const model = badgeModel(id);
      if (model === undefined) throw new Error(`no model for ${id}`);
      const { body, art, face } = badgeGeometry(model, false);
      expect(body).toBeNull();
      expect(face).toBe(0);
      expect(finite(art)).toBe(true);
      expect(art.getAttribute("position").count).toBeGreaterThan(0);
      const earned = strokesOf(model, true);
      const unearned = strokesOf(model, false);
      expect(unearned[0]?.runs.length).toBeGreaterThan(
        earned[0]?.runs.length ?? 0,
      );
      expect(unearned.at(-1)).toEqual(earned.at(-1));
    });
  });
});

describe("dashes", () => {
  test("a run is cut into dashes and gaps along its length", () => {
    const line = [new Vector2(0, 0), new Vector2(14, 0)];
    expect(dashed(line, [4, 3]).map((d) => d.map((p) => p.x))).toEqual([
      [0, 4],
      [7, 11],
    ]);
  });

  test("a dash carries on round a corner", () => {
    const corner = [new Vector2(0, 0), new Vector2(2, 0), new Vector2(2, 5)];
    expect(dashed(corner, [4, 3]).map((d) => d.map((p) => [p.x, p.y]))).toEqual(
      [
        [
          [0, 0],
          [2, 0],
          [2, 2],
        ],
      ],
    );
  });
});
