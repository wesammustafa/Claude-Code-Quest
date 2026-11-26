// @vitest-environment node
// A Lesson's card as the room draws it (D4): a complete Lesson's card is
// pinned and in the look's done colour, the place's next card is edged in
// the mark's colour, and an optional Lesson's card is in its own colour.
// The look here gives each a pure hue, so the baked light keeps it.
import { describe, expect, test } from "vitest";
import type { SceneLook } from "../../../mount/types";
import { SURFACES } from "./cards";
import { cardsGeometry, type CardLook } from "./room";

const LOOK: SceneLook = {
  sky: "#ffffff",
  ground: "#808080",
  light: "#ffffff",
  ambient: 2,
  key: 1,
  shadow: "#000000",
  workshop: {
    ambient: 2,
    key: 1,
    lamp: 0,
    floor: "#ffffff",
    wall: "#808080",
    wood: "#808080",
    fabric: "#808080",
    teal: "#808080",
    leaf: "#808080",
    window: "#808080",
    glow: "#808080",
    paper: "#e0e0e0",
    ink: "#404040",
    done: "#00d000",
    optional: "#0000d0",
    next: "#d00000",
  },
};

type Hue = "red" | "green" | "blue";

/** What a lone card on the noticeboard draws: the hues its faces take, and how far its parts stand out of the cork. */
function drawnCard(card: Omit<CardLook, "lesson">) {
  const g = cardsGeometry(LOOK, "noticeboard", [{ lesson: "b-1", ...card }]);
  const colour = g.getAttribute("color");
  const hues = new Set<Hue>();
  for (let i = 0; i < colour.count; i++) {
    const [r, gr, b] = [colour.getX(i), colour.getY(i), colour.getZ(i)];
    if (r > gr + 0.2 && r > b + 0.2) hues.add("red");
    if (gr > r + 0.2 && gr > b + 0.2) hues.add("green");
    if (b > r + 0.2 && b > gr + 0.2) hues.add("blue");
  }
  g.computeBoundingBox();
  const out = (g.boundingBox?.max.z ?? 0) - SURFACES.noticeboard.centre[2];
  return { hues, out };
}

describe("a Lesson's card", () => {
  const plain = drawnCard({ complete: false, optional: false, next: false });

  test("complete, it is pinned and done's colour", () => {
    const done = drawnCard({ complete: true, optional: false, next: false });
    expect(done.hues).toEqual(new Set(["green"]));
    expect(done.out).toBeGreaterThan(0.04);
    expect(plain.out).toBeLessThan(0.04);
  });

  test("the place's next card is edged in the mark's colour, and an optional one is its own colour", () => {
    expect(
      drawnCard({ complete: false, optional: false, next: true }).hues,
    ).toEqual(new Set(["red"]));
    expect(
      drawnCard({ complete: false, optional: true, next: false }).hues,
    ).toEqual(new Set(["blue"]));
  });

  test("a card still to do, not next and not optional, takes none of those colours", () => {
    expect(plain.hues.size).toBe(0);
  });
});
