import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { SceneProps } from "../../mount/types";
import { pixelRatioCap } from "../tier";
import { Ground } from "./Ground";

/** Where the camera stands and looks: over the ground, toward the far distance. */
const CAMERA = { position: [0, 2.4, 8] as const, fov: 45, near: 0.1, far: 120 };
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
  return (
    <Canvas
      data-scene-canvas=""
      data-scene-frameloop={frameloop}
      frameloop={frameloop}
      dpr={[1, pixelRatioCap(tier)]}
      shadows={tier === "desktop"}
      gl={{
        antialias: tier === "desktop",
        powerPreference: tier === "phone" ? "low-power" : "default",
      }}
      camera={{ ...CAMERA, position: [...CAMERA.position] }}
      onCreated={({ gl, camera }) => {
        const canvas = gl.domElement;
        canvas.setAttribute("aria-hidden", "true");
        canvas.addEventListener("webglcontextlost", () => {
          lost.current();
        });
        camera.lookAt(...LOOK_AT);
      }}
    >
      <color attach="background" args={[look.sky]} />
      <fog attach="fog" args={[look.sky, 14, 60]} />
      <hemisphereLight args={[look.sky, look.ground, 1.6]} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.2}
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
