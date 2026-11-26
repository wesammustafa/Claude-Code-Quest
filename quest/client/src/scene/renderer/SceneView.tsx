import { Canvas, useFrame, type CameraProps } from "@react-three/fiber";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { SceneProps, ScreenOnShow } from "../../mount/types";
import { SceneContext } from "../context";
import { journeyPathOf } from "../path";
import { pixelRatioCap } from "../tier";
import { pipOnScreen } from "../workshop/goal";
import { workshopPlaces } from "../workshop/places";
import { CameraRig } from "./CameraRig";
import { FOV } from "./camera";
import { SceneBadges } from "./badges/SceneBadges";
import { WorkshopPip } from "./pip/WorkshopPip";
import { WorkshopLamps, WorkshopRoom } from "./workshop/WorkshopRoom";

/** The camera's lens; the rig sets where it stands. One object, so a new render of the canvas never sets it again. */
const CAMERA: CameraProps = { fov: FOV, near: 0.1, far: 80 };

/** A followed value: read it with `get`, hear it change with `subscribe`. */
interface Followed<T> {
  get: () => T;
  subscribe: (fn: () => void) => () => void;
}

/** A value the renderer reads as it changes, so a new screen re-renders none of the canvas. */
function useFollowed<T>(value: T): Followed<T> {
  const [held] = useState(() => {
    let current = value;
    const listeners = new Set<() => void>();
    return {
      get: () => current,
      set: (next: T) => {
        if (Object.is(next, current)) return;
        current = next;
        for (const fn of [...listeners]) fn();
      },
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
    };
  });
  useLayoutEffect(() => {
    held.set(value);
  }, [held, value]);
  return held;
}

/**
 * The Scene's renderer (seam S12): one canvas, `aria-hidden` and never in
 * the Tab order, drawing the workshop room (the warm workshop, D3) with
 * its light baked into its colours, so no tier needs a shadow map, and a
 * card for every Lesson at its Level's place; the light here is for the 3D
 * Badges and, with the mount's `pip`, the 3D Pip (seam S13), the one Pip
 * of every screen the Scene runs on, standing in the room. A desktop
 * draws every frame, with antialiasing and a gentle sway over the whole
 * room; a phone draws at a capped pixel ratio, and only when something
 * changes; stopped, it draws nothing. The screen is followed rather than
 * rendered, so a screen change re-renders nothing in the canvas: the
 * camera rig and the 3D Pip read it. A lost WebGL context hands over to
 * the still images.
 */
export function SceneView({
  screen,
  stations,
  tier,
  running,
  look,
  theme,
  onReady,
  onLost,
  pip = false,
}: SceneProps): ReactNode {
  const frameloop = !running ? "never" : tier === "phone" ? "demand" : "always";
  const lost = useRef(onLost);
  useEffect(() => {
    lost.current = onLost;
  }, [onLost]);
  // R3F loses the context itself once this canvas unmounts (a change of
  // tier, the still tier): that loss is the renderer's teardown, not the
  // GPU's, so the listener goes before it.
  const detach = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      detach.current?.();
      detach.current = null;
    },
    [],
  );
  const shown = useFollowed<ScreenOnShow>(screen);
  const places = useMemo(() => workshopPlaces(stations), [stations]);
  // Each card complete or not, in the places' order, for checks to read.
  const lit = places
    .flatMap((p) => p.cards.map((c) => (c.complete ? "1" : "0")))
    .join("");
  // The same element while nothing it draws changes, so React leaves the canvas alone.
  return useMemo(
    () => (
      <Canvas
        data-scene-canvas=""
        data-scene-frameloop={frameloop}
        data-scene-lit={lit}
        frameloop={frameloop}
        dpr={[1, pixelRatioCap(tier)]}
        // The look's colours as given, with no filmic tone curve over them.
        flat
        gl={{
          antialias: tier === "desktop",
          powerPreference: tier === "phone" ? "low-power" : "default",
        }}
        camera={CAMERA}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.setAttribute("aria-hidden", "true");
          const onContextLost = () => {
            lost.current();
          };
          canvas.addEventListener("webglcontextlost", onContextLost);
          detach.current = () => {
            canvas.removeEventListener("webglcontextlost", onContextLost);
          };
        }}
      >
        <color attach="background" args={[look.sky]} />
        <hemisphereLight args={[look.light, look.ground, look.ambient]} />
        <directionalLight
          color={look.light}
          position={[8, 5, 2]}
          intensity={look.key}
        />
        <WorkshopRoom look={look} places={places} />
        <CameraRig
          screen={shown}
          stations={stations}
          sway={tier === "desktop"}
          feet={!pip}
        />
        <WorkshopLamps look={look} />
        <SceneBadges theme={theme} />
        <FirstFrame onReady={onReady} />
        {pip && (
          <FollowedPip
            screen={shown}
            stations={stations}
            tier={tier}
            theme={theme}
            shadow={look.shadow}
          />
        )}
      </Canvas>
    ),
    [frameloop, lit, tier, look, theme, pip, shown, stations, places, onReady],
  );
}

/**
 * The 3D Pip on the followed screen, walked to the goal it gives him (D5):
 * only this renders again when the screen, or the Lesson the Journey stands
 * at, changes. He first comes on a screen the Scene runs on; where the
 * Scene stops he leaves the room, so the screen's own Pip is the one, yet
 * stays loaded where he stood for the way back.
 */
function FollowedPip({
  screen,
  stations,
  tier,
  theme,
  shadow,
}: {
  screen: Followed<ScreenOnShow>;
  stations: SceneProps["stations"];
  tier: SceneProps["tier"];
  theme: SceneProps["theme"];
  shadow: string;
}): ReactNode {
  const current = useSyncExternalStore(screen.subscribe, screen.get);
  const path = journeyPathOf(useContext(SceneContext));
  const at = useSyncExternalStore(path.subscribe, path.at);
  const pip = pipOnScreen(current, at, stations);
  // A renderer that loads while the Learner is already on a Workspace
  // fetches no model there.
  const [entered, setEntered] = useState(pip.inRoom);
  if (pip.inRoom && !entered) setEntered(true);
  if (!entered) return null;
  return (
    <WorkshopPip
      goal={pip.inRoom ? pip.goal : null}
      inRoom={pip.inRoom}
      tier={tier}
      theme={theme}
      shadow={shadow}
    />
  );
}

/** Tells the layer once the first frame is being drawn. */
function FirstFrame({ onReady }: { onReady: () => void }): null {
  const told = useRef(false);
  useFrame(() => {
    if (told.current) return;
    told.current = true;
    onReady();
  });
  return null;
}
