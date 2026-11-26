// Where the workshop's named things fall on the page in a frame (the warm
// workshop, D8): each place and each Lesson's card, as the aimed camera
// draws them, for the screens' tags and links over the Scene, and the
// cards and Pip's feet as today's Journey stage reads its Stations and its
// Pip. Projection only, with no renderer, so a test holds it with a camera
// of its own.
import { Vector3, type Camera, type Vector3Like } from "three";
import type { PathView, StationPoint } from "../../path";
import type { Anchor, AnchorId, Anchors } from "../../workshop/store";
import type { WorkshopPlace, WorkshopPlaceId } from "../../workshop/places";
import { onSurface, placedCards, SURFACES, type PlacedCard } from "./cards";
import { PLACE_ANCHORS } from "./room";

/** The canvas's box on the page, in CSS pixels. */
export interface PageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A card as the page is told it: where it is drawn, and whether its Lesson is complete. */
export type ToldCard = PlacedCard & { complete: boolean };

/** A Station's reach for a tap, at the least: a 44 px target (WCAG 2.5.8's enhanced size). */
const MIN_REACH_PX = 22;

/** What one frame tells the page: the workshop's anchors, and the Journey's view of the cards. */
export interface Told {
  anchors: Anchors;
  view: PathView;
}

/** Where each place and card, and Pip's feet on the Journey's stage (`pip`, or null), fall on the page through `camera`, and whether each is in view. */
export function tellPage(
  camera: Camera,
  page: PageBox,
  places: readonly WorkshopPlaceId[],
  cards: readonly ToldCard[],
  pip: Vector3Like | null = null,
): Told {
  const v = new Vector3();
  const toPage = (p: readonly [number, number, number]): Anchor => {
    v.set(...p).project(camera);
    const x = page.left + ((v.x + 1) / 2) * page.width;
    const y = page.top + ((1 - v.y) / 2) * page.height;
    return {
      x,
      y,
      ahead: v.z < 1,
      visible:
        v.z < 1 &&
        x >= page.left &&
        x <= page.left + page.width &&
        y >= page.top &&
        y <= page.top + page.height,
    };
  };
  const anchors: Partial<Record<AnchorId, Anchor>> = {};
  for (const place of places) anchors[place] = toPage(PLACE_ANCHORS[place]);
  const points: StationPoint[] = [];
  for (const card of cards) {
    const at = toPage(card.at);
    anchors[`card:${card.lesson}` satisfies AnchorId] = at;
    if (!at.visible) continue;
    const edge = toPage(
      onSurface(
        SURFACES[card.place],
        card.slot.x + card.slot.width / 2,
        card.slot.y,
      ),
    );
    points.push({
      lesson: card.lesson,
      x: at.x,
      y: at.y,
      r: Math.max(MIN_REACH_PX, Math.hypot(edge.x - at.x, edge.y - at.y)),
      lit: card.complete,
    });
  }
  let feet: PathView["pip"] = null;
  if (pip !== null) {
    const { x, y } = toPage([pip.x, pip.y, pip.z]);
    // Behind the camera, his feet are drawn nowhere.
    if (v.z < 1) feet = { x, y };
  }
  return { anchors, view: { points, pip: feet } };
}

/** Every place's cards, in the places' order and each place's own, with each Lesson's state. */
export function toldCards(places: readonly WorkshopPlace[]): ToldCard[] {
  return places.flatMap((place) =>
    placedCards(
      place.id,
      place.cards.map((c) => c.lesson),
    ).map((card, i) => ({
      ...card,
      complete: place.cards[i]?.complete === true,
    })),
  );
}
