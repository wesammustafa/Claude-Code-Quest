import { Canvas, useFrame, type CameraProps } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { SceneProps } from "../../mount/types";
import { pixelRatioCap } from "../tier";
import { Ground } from "./Ground";

/**
 * Where the camera stands and looks: over the ground, toward the far
 * distance. One object, so a new render of the canvas never sets it again.
 */
const CAMERA: CameraProps = {
  position: [0, 2.4, 8],
  fov: 45,
  near: 0.1,
  far: 120,
};
const LOOK_AT = [0, 0.6, -8] as const;
/** The desktop's slow sway of the camera, side to side, in radians per second and units. */
const SWAY_RATE = 0.06;
const SWAY = 0.8;

/**
 * The Scene's renderer (seam S12): one canvas, `aria-hidden` and never in
 * the Tab order. A desktop draws every frame, with shadows and a slow sway;
 * a phone draws at a capped pixel ratio, with no shadows or post effects,
 * and only when something changes; stopped, it draws nothing. Today it
 * holds a placeholder ground in the mount's colours; the landscapes come
 * later. A lost WebGL context hands over to the still images.
 */
export function SceneView({
  tier,
  running,
  look,
  onReady,
  onLost,
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
  return (
    <Canvas
      data-scene-canvas=""
      data-scene-frameloop={frameloop}
      frameloop={frameloop}
      dpr={[1, pixelRatioCap(tier)]}
      shadows={tier === "desktop"}
      // The look's colours as given, with no filmic tone curve over them.
      flat
      gl={{
        antialias: tier === "desktop",
        powerPreference: tier === "phone" ? "low-power" : "default",
      }}
      camera={CAMERA}
      onCreated={({ gl, camera }) => {
        const canvas = gl.domElement;
        canvas.setAttribute("aria-hidden", "true");
        const onContextLost = () => {
          lost.current();
        };
        canvas.addEventListener("webglcontextlost", onContextLost);
        detach.current = () => {
          canvas.removeEventListener("webglcontextlost", onContextLost);
        };
        camera.lookAt(...LOOK_AT);
      }}
    >
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, 14, 60]} />
      <hemisphereLight args={[look.light, look.ground, look.ambient]} />
      <directionalLight
        color={look.light}
        position={[8, 5, 2]}
        intensity={look.key}
        castShadow={tier === "desktop"}
        shadow-mapSize={[1024, 1024]}
      />
      <Ground color={look.ground} shadows={tier === "desktop"} />
      {tier === "desktop" && <Sway />}
      <FirstFrame onReady={onReady} />
    </Canvas>
  );
}

/** The desktop's sway: the camera drifts side to side, looking at the same point. */
function Sway(): null {
  useFrame(({ camera, clock }) => {
    camera.position.x = Math.sin(clock.elapsedTime * SWAY_RATE) * SWAY;
    camera.lookAt(...LOOK_AT);
  });
  return null;
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
