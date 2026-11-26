import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  DoubleSide,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
} from "three";
import type { LessonId } from "@quest/contract";
import { motionTokens } from "../../../lib/motion";
import type { SceneLook } from "../../../mount/types";
import { useCardPin, type CardPin } from "../../workshop/pin";
import type { WorkshopPlace, WorkshopPlaceId } from "../../workshop/places";
import { cubicBezier } from "../camera";
import { LAMPS } from "./bake";
import { placedCards, SURFACES } from "./cards";
import {
  cardLooks,
  cardsGeometry,
  lampGeometry,
  placeGeometry,
  roomGeometry,
  shadowsGeometry,
} from "./room";

/** Frees a geometry or material once the room no longer draws it. */
function useDisposed<T extends BufferGeometry | Material>(made: T): T {
  useEffect(
    () => () => {
      made.dispose();
    },
    [made],
  );
  return made;
}

const PLACE_IDS: readonly WorkshopPlaceId[] = [
  "noticeboard",
  "organizer",
  "release-desk",
];

/**
 * The workshop room (the warm workshop, D3, D4): its floor, walls and
 * furniture, every colour baked from the look and drawn unlit; the soft
 * shadows on its floor; and each Level's place with a card for every one
 * of its Lessons, the place's furniture tagged for the pick. A card reads
 * only its Lesson's `complete` and `optional` (09 9.3): the Scene keeps no
 * progress of its own. A card the layer is pinning now settles onto its
 * place, drawn apart from the rest until the pin's moment ends.
 */
export const WorkshopRoom = memo(function WorkshopRoom({
  look,
  places,
}: {
  look: SceneLook;
  places: readonly WorkshopPlace[];
}): ReactNode {
  const baked = useDisposed(
    useMemo(() => new MeshBasicMaterial({ vertexColors: true }), []),
  );
  const shadowed = useDisposed(
    useMemo(
      () =>
        new MeshBasicMaterial({
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
        }),
      [],
    ),
  );
  const room = useDisposed(useMemo(() => roomGeometry(look), [look]));
  const shadows = useDisposed(useMemo(() => shadowsGeometry(look), [look]));
  return (
    <group>
      <mesh geometry={room} material={baked} />
      <mesh geometry={shadows} material={shadowed} renderOrder={1} />
      {PLACE_IDS.map((id) => (
        <Place
          key={id}
          id={id}
          look={look}
          place={places.find((p) => p.id === id) ?? null}
          material={baked}
        />
      ))}
    </group>
  );
});

/** One Level's place: its furniture and its cards, tagged as the place while its Level has Lessons. */
function Place({
  id,
  look,
  place,
  material,
}: {
  id: WorkshopPlaceId;
  look: SceneLook;
  place: WorkshopPlace | null;
  material: MeshBasicMaterial;
}): ReactNode {
  const furniture = useDisposed(
    useMemo(() => placeGeometry(look, id), [look, id]),
  );
  // The cards as they show, as a string, so an equal place draws nothing new.
  const shown = JSON.stringify(
    place === null ? [] : cardLooks(place.cards, place.next),
  );
  const pin = useCardPin();
  const pinning =
    pin !== null && place?.cards.some((c) => c.lesson === pin.lesson) === true
      ? pin
      : null;
  const apart = pinning?.lesson ?? null;
  const cards = useDisposed(
    useMemo(
      () =>
        cardsGeometry(
          look,
          id,
          JSON.parse(shown) as ReturnType<typeof cardLooks>,
          (lesson) => lesson !== apart,
        ),
      [look, id, shown, apart],
    ),
  );
  const tagged = place !== null;
  const pick = useMemo(
    () => (tagged ? { pick: { kind: "place", place: id } } : {}),
    [tagged, id],
  );
  return (
    <group userData={pick}>
      <mesh geometry={furniture} material={material} />
      <mesh geometry={cards} material={material} />
      {pinning !== null && (
        <PinningCard
          // A new pin starts from its own first frame.
          key={`${pinning.lesson} ${String(pinning.startedAt)}`}
          look={look}
          place={id}
          shown={shown}
          pin={pinning}
          material={material}
        />
      )}
    </group>
  );
}

/** How far out of its surface a pinning card starts, in the Scene's units, and how much larger. */
const PIN_LIFT = 0.35;
const PIN_GROW = 0.25;

/**
 * The card pinning now: it starts lifted out of its place and a little
 * larger, and settles into its slot, pinned, over the moment's time, eased
 * by the motion tokens; a moment of no time draws it in place at once.
 */
function PinningCard({
  look,
  place,
  shown,
  pin,
  material,
}: {
  look: SceneLook;
  place: WorkshopPlaceId;
  shown: string;
  pin: CardPin;
  material: MeshBasicMaterial;
}): ReactNode {
  const { lesson } = pin;
  const geometry = useDisposed(
    useMemo(() => {
      const cards = JSON.parse(shown) as ReturnType<typeof cardLooks>;
      return cardsGeometry(look, place, cards, (l) => l === lesson);
    }, [look, place, shown, lesson]),
  );
  const centre = useMemo(() => {
    const cards = JSON.parse(shown) as { lesson: LessonId }[];
    const at = placedCards(
      place,
      cards.map((c) => c.lesson),
    ).find((c) => c.lesson === lesson)?.at;
    return new Vector3(...(at ?? SURFACES[place].centre));
  }, [place, shown, lesson]);
  const out = useMemo(() => new Vector3(...SURFACES[place].out), [place]);
  const ease = useMemo(() => {
    const e = motionTokens().out;
    return e === "linear" ? (t: number) => t : cubicBezier(...e);
  }, []);
  const invalidate = useThree((s) => s.invalidate);
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    const card = mesh.current;
    if (card === null) return;
    const t =
      pin.ms <= 0
        ? 1
        : Math.min(
            1,
            Math.max(0, (performance.now() - pin.startedAt) / pin.ms),
          );
    // What is left of the moment: 1 at its start, 0 once settled.
    const left = 1 - ease(t);
    const grow = 1 + PIN_GROW * left;
    // Grown about the card's own centre, and lifted out along its surface.
    card.scale.setScalar(grow);
    card.position
      .copy(centre)
      .multiplyScalar(1 - grow)
      .addScaledVector(out, PIN_LIFT * left);
    // The phone draws on demand: it draws again until the card settles.
    if (t < 1) invalidate();
  });
  return <mesh ref={mesh} geometry={geometry} material={material} />;
}

/** How near the camera may come to a lamp's shade, in the Scene's units, before it leaves the lamp out of its view. */
const LAMP_CLEAR = 2.4;

/**
 * The hanging lamps, drawn after the camera has been placed for the frame,
 * so a framing that brings it close to a lamp leaves that lamp out rather
 * than filling the view with its shade.
 */
export const WorkshopLamps = memo(function WorkshopLamps({
  look,
}: {
  look: SceneLook;
}): ReactNode {
  const baked = useDisposed(
    useMemo(() => new MeshBasicMaterial({ vertexColors: true }), []),
  );
  const lamps = useMemo(
    () => LAMPS.map((_, i) => lampGeometry(look, i)),
    [look],
  );
  useEffect(
    () => () => {
      for (const g of lamps) g.dispose();
    },
    [lamps],
  );
  const shades = useMemo(() => LAMPS.map((at) => new Vector3(...at)), []);
  const meshes = useRef<(Mesh | null)[]>([]);
  useFrame(({ camera }) => {
    shades.forEach((at, i) => {
      const mesh = meshes.current[i];
      if (mesh) mesh.visible = camera.position.distanceTo(at) > LAMP_CLEAR;
    });
  });
  return lamps.map((geometry, i) => (
    <mesh
      key={i}
      ref={(mesh) => {
        meshes.current[i] = mesh;
      }}
      geometry={geometry}
      material={baked}
    />
  ));
});
