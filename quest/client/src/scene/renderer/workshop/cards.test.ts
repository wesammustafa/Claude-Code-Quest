// @vitest-environment node
// The Lessons' cards on their places' surfaces (D4): every count a course
// can give a Level, up to 12, laid in the place's order, read left to right
// and top to bottom, with no card over another or over the surface's edge.
import { describe, expect, test } from "vitest";
import type { WorkshopPlaceId } from "../../workshop/places";
import {
  layoutCards,
  placedCards,
  SURFACES,
  type CardSlot,
  type CardSurface,
} from "./cards";

/** A card's extent, leaning, as half its width and height across and up the surface. */
function reach(slot: CardSlot): { x: number; y: number } {
  const cos = Math.cos(slot.lean);
  const sin = Math.abs(Math.sin(slot.lean));
  return {
    x: (slot.width * cos + slot.height * sin) / 2,
    y: (slot.width * sin + slot.height * cos) / 2,
  };
}

const overlap = (a: CardSlot, b: CardSlot) => {
  const ra = reach(a);
  const rb = reach(b);
  return Math.abs(a.x - b.x) < ra.x + rb.x && Math.abs(a.y - b.y) < ra.y + rb.y;
};

const PLACES = Object.keys(SURFACES) as WorkshopPlaceId[];

describe("the cards' layout", () => {
  test("from 1 to 12 cards, on every place's surface, none overlaps another or the surface's edge", () => {
    for (const place of PLACES) {
      const surface: CardSurface = SURFACES[place];
      for (let count = 1; count <= 12; count++) {
        const slots = layoutCards(count, surface);
        expect(slots, `${place} ${String(count)}`).toHaveLength(count);
        slots.forEach((slot, i) => {
          const r = reach(slot);
          expect(Math.abs(slot.x) + r.x).toBeLessThanOrEqual(surface.width / 2);
          expect(Math.abs(slot.y) + r.y).toBeLessThanOrEqual(
            surface.height / 2,
          );
          expect(slot.width).toBeGreaterThan(0);
          expect(slot.width).toBeLessThanOrEqual(surface.maxWidth);
          expect(Math.abs(slot.lean)).toBeLessThanOrEqual(surface.lean);
          for (const other of slots.slice(i + 1))
            expect(overlap(slot, other), `${place} ${String(count)}`).toBe(
              false,
            );
        });
      }
    }
  });

  test("cards read in the place's order: left to right along a row, rows from the top", () => {
    const slots = layoutCards(10, SURFACES["release-desk"]);
    for (let i = 1; i < slots.length; i++) {
      const [a, b] = [slots[i - 1], slots[i]];
      if (a === undefined || b === undefined) continue;
      if (a.y === b.y) expect(b.x).toBeGreaterThan(a.x);
      else expect(b.y).toBeLessThan(a.y);
    }
    expect(new Set(slots.map((s) => s.y)).size).toBeGreaterThan(1);
  });

  test("no Lessons lay no cards", () => {
    expect(layoutCards(0, SURFACES.noticeboard)).toEqual([]);
    expect(placedCards("organizer", [])).toEqual([]);
  });

  test("each Lesson's card is placed on its place's surface, in the order given", () => {
    const cards = placedCards("noticeboard", ["b-1", "b-2", "b-3"]);
    expect(cards.map((c) => c.lesson)).toEqual(["b-1", "b-2", "b-3"]);
    const [x0, , z0] = SURFACES.noticeboard.centre;
    for (const card of cards) {
      expect(card.place).toBe("noticeboard");
      expect(card.at[2]).toBeCloseTo(z0, 5);
      expect(Math.abs(card.at[0] - x0)).toBeLessThan(
        SURFACES.noticeboard.width / 2,
      );
    }
  });
});
