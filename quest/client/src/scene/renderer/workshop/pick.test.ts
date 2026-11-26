// @vitest-environment node
// The workshop's pick (D8): what lies under a point of the page, read from
// what the ray from the camera met, nearest first: the first thing tagged
// as Pip or a place, else the floor inside the room, else nothing.
import { describe, expect, test } from "vitest";
import { floorHit, pickOf, type PickNode } from "./pick";

const node = (
  pick?: unknown,
  parent: PickNode | null = null,
  visible = true,
): PickNode => ({
  userData: pick === undefined ? {} : { pick },
  visible,
  parent,
});
const hit = (object: PickNode) => ({ object });

const noticeboard = node({ kind: "place", place: "noticeboard" });
const pip = node({ kind: "pip" });
const wall = node();

describe("the workshop's pick", () => {
  test("the nearest tagged thing wins, its tag read from whatever holds the part the ray met", () => {
    const card = node(undefined, node(undefined, noticeboard));
    expect(pickOf([hit(wall), hit(card), hit(pip)], null)).toEqual({
      kind: "place",
      place: "noticeboard",
    });
    expect(pickOf([hit(node(undefined, pip)), hit(card)], null)).toEqual({
      kind: "pip",
    });
  });

  test("with nothing tagged met, the floor inside the room, and nothing off it", () => {
    expect(pickOf([hit(wall)], { x: 1.5, z: 2 })).toEqual({
      kind: "floor",
      x: 1.5,
      z: 2,
    });
    expect(pickOf([], { x: 1.5, z: 8 })).toBeNull();
    expect(pickOf([], null)).toBeNull();
  });

  test("a hidden part, or a tag the workshop does not know, is passed over", () => {
    const hidden = node(undefined, node({ kind: "pip" }, null, false));
    const unknown = node({ kind: "place", place: "kitchen" });
    const odd = node("pip");
    expect(
      pickOf([hit(hidden), hit(unknown), hit(odd), hit(noticeboard)], null),
    ).toEqual({ kind: "place", place: "noticeboard" });
  });

  test("a ray meets the floor only going down from above it", () => {
    expect(floorHit({ x: 0, y: 4, z: 8 }, { x: 0, y: -1, z: -1 })).toEqual({
      x: 0,
      z: 4,
    });
    expect(floorHit({ x: 0, y: 4, z: 8 }, { x: 0, y: 0.2, z: -1 })).toBeNull();
    expect(floorHit({ x: 0, y: -1, z: 8 }, { x: 0, y: -1, z: 0 })).toBeNull();
  });
});
