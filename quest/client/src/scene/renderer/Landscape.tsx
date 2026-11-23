import { memo, useEffect, useMemo, type ReactNode } from "react";
import { DoubleSide, MeshBasicMaterial, type BufferGeometry } from "three";
import type { SceneLook, SceneStation } from "../../mount/types";
import { beaconOf, beginnerStations } from "./camera";
import {
  beaconGeometry,
  beginnerLayout,
  groundGeometry,
  haloGeometry,
  pathGeometry,
  plinthsGeometry,
  propsGeometry,
  STATIONS,
} from "./beginner";

/** Each Beginner Station lit or not, in path order, from the stations the Scene is told; a missing one is unlit. */
export function litStations(stations: readonly SceneStation[]): boolean[] {
  const beginner = beginnerStations(stations);
  return Array.from(
    { length: STATIONS },
    (_, i) => beginner[i]?.complete === true,
  );
}

/** Frees a geometry or material once the landscape no longer draws it. */
function useDisposed<T extends { dispose: () => void }>(made: T): T {
  useEffect(
    () => () => {
      made.dispose();
    },
    [made],
  );
  return made;
}

/**
 * The Beginner landscape (09 9.2 Look): its ground, path, trees and rocks
 * and six Stations, every colour baked from the look, drawn unlit. A
 * Station's beacon and the ring at its foot light when its Lesson is
 * complete, from the snapshot's field alone.
 */
export const Landscape = memo(function Landscape({
  look,
  lit,
}: {
  look: SceneLook;
  /** Each Station lit or not, in path order, as a string of 0 and 1 so an equal one draws nothing new. */
  lit: string;
}): ReactNode {
  const baked = useDisposed(
    useMemo(() => new MeshBasicMaterial({ vertexColors: true }), []),
  );
  const ground = useDisposed(useMemo(() => groundGeometry(look), [look]));
  const path = useDisposed(useMemo(() => pathGeometry(look), [look]));
  const props = useDisposed(useMemo(() => propsGeometry(look), [look]));
  const plinths = useDisposed(useMemo(() => plinthsGeometry(look), [look]));
  const { stone, lit: glow } = look.landscape;
  const unlitBeacon = useDisposed(
    useMemo(() => new MeshBasicMaterial({ color: stone }), [stone]),
  );
  const litBeacon = useDisposed(
    useMemo(() => new MeshBasicMaterial({ color: glow }), [glow]),
  );
  const halo = useDisposed(
    useMemo(
      () =>
        new MeshBasicMaterial({
          color: glow,
          transparent: true,
          opacity: 0.55,
          side: DoubleSide,
          depthWrite: false,
        }),
      [glow],
    ),
  );
  const beacon = useDisposed(useMemo(() => beaconGeometry(false), []));
  const capBeacon = useDisposed(useMemo(() => beaconGeometry(true), []));
  const ring = useDisposed(useMemo(() => haloGeometry(false), []));
  const capRing = useDisposed(useMemo(() => haloGeometry(true), []));
  const { stations } = beginnerLayout();
  return (
    <group>
      <Baked geometry={ground} material={baked} />
      <Baked geometry={path} material={baked} />
      <Baked geometry={props} material={baked} />
      <Baked geometry={plinths} material={baked} />
      {stations.map((foot, i) => {
        const on = lit[i] === "1";
        const capstone = i === stations.length - 1;
        return (
          <group key={i}>
            <mesh
              position={beaconOf(i)}
              geometry={capstone ? capBeacon : beacon}
              material={on ? litBeacon : unlitBeacon}
            />
            {on && (
              <mesh
                position={[foot.x, foot.y + 0.04, foot.z]}
                geometry={capstone ? capRing : ring}
                material={halo}
              />
            )}
          </group>
        );
      })}
    </group>
  );
});

function Baked({
  geometry,
  material,
}: {
  geometry: BufferGeometry;
  material: MeshBasicMaterial;
}): ReactNode {
  return <mesh geometry={geometry} material={material} />;
}
