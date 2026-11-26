import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  DoubleSide,
  MeshBasicMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh,
} from "three";
import type { SceneLook } from "../../../mount/types";
import type { WorkshopPlace, WorkshopPlaceId } from "../../workshop/places";
import { LAMPS } from "./bake";
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
 * progress of its own.
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
  const cards = useDisposed(
    useMemo(
      () =>
        cardsGeometry(
          look,
          id,
          JSON.parse(shown) as ReturnType<typeof cardLooks>,
        ),
      [look, id, shown],
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
    </group>
  );
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
