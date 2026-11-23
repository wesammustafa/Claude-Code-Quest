// Seam S13: the 3D Pip, a second renderer of the guide's own Pip, drawn in
// the Scene from the one director's PipModel. It loads its model after the
// Scene has drawn, and holds Pip (S12's useScenePip) only once the model
// has passed its contract and been placed, and compiled, where the screen
// puts Pip; he shows only once the screen's own Pip has stood down, so the
// two never draw together. Until then, if the model fails, and wherever the
// Scene cannot run, the screen's own Pip shows, with its posters as the
// Rive renderer shows them.
// On a Lesson's step the Scene stops and lets Pip go, so the Workspace
// keeps the 2D Pip.
import { useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Box3,
  Mesh,
  Vector3,
  type Group,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import type { SceneTier, ScreenOnShow } from "../../../mount/types";
import { reactionLedger } from "../../../pip/playback";
import { followPointer } from "../../../pip/pointer";
import { usePipInput, usePipModel } from "../../../pip/PipStage";
import { useScenePip } from "../../context";
import { findPipSpot, spotShows } from "../../pip-spot";
import { sceneStops } from "../../SceneLayer";
import modelUrl from "../../../../pip/model/pip.glb?url";
import { PipDrive, frameStep } from "./drive";
import { loadPipModel, type PipModel3D } from "./load";
import { placeAtSpot } from "./place";

export interface ScenePipProps {
  screen: ScreenOnShow;
  tier: Exclude<SceneTier, "still">;
}

type Loaded =
  { state: "loading" | "failed" } | { state: "ready"; model: PipModel3D };

/** The 3D Pip: his model loading, then driven, or nothing where it fails. */
export function ScenePip({ screen, tier }: ScenePipProps): ReactNode {
  const canvas = useThree((s) => s.gl.domElement);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  useEffect(() => {
    let live = true;
    loadPipModel(modelUrl).then(
      (model) => {
        if (live) setLoaded({ state: "ready", model });
      },
      () => {
        if (live) setLoaded({ state: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (loaded.state !== "ready") return;
    const { scene } = loaded.model;
    return () => {
      disposeTree(scene);
    };
  }, [loaded]);
  useEffect(() => {
    if (loaded.state !== "ready")
      canvas.setAttribute("data-scene-pip", loaded.state);
  }, [canvas, loaded.state]);
  useEffect(
    () => () => {
      for (const name of canvas.getAttributeNames())
        if (name.startsWith("data-scene-pip")) canvas.removeAttribute(name);
    },
    [canvas],
  );
  if (loaded.state !== "ready") return null;
  return <Driven model={loaded.model} screen={screen} tier={tier} />;
}

/** The loaded model, placed at Pip's box each frame and played from the director's model. */
function Driven({
  model,
  screen,
  tier,
}: ScenePipProps & { model: PipModel3D }): ReactNode {
  const pip = usePipModel();
  const send = usePipInput();
  const canvas = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Group>(null);
  const [driver] = useState(() => new PipDrive(model.scene, model.clips));
  useEffect(
    () => () => {
      driver.dispose();
    },
    [driver],
  );
  // The model's size and centre in its still pose, before any clip moves it.
  const { height, centre } = useMemo(() => {
    const bounds = new Box3().setFromObject(model.scene);
    return {
      height: bounds.getSize(new Vector3()).y,
      centre: bounds.getCenter(new Vector3()),
    };
  }, [model]);

  const stopped = sceneStops(screen.screen);
  const [drawn, setDrawn] = useState(false);
  const holding = drawn && !stopped;
  const hold = tier === "phone";

  useEffect(() => {
    driver.set(pip, hold);
    invalidate();
  }, [driver, pip, hold, invalidate]);

  // A Reaction plays once per ID in this tab, as on the Rive rig: one the
  // screen's Pip already played never plays again here. Under reduced
  // motion Pip holds still, so it is spent unplayed.
  const reaction = pip.reaction;
  useLayoutEffect(() => {
    if (reaction !== null) reactionLedger.arrive(reaction.id);
  }, [reaction]);
  useEffect(() => {
    if (!holding || reaction === null) return;
    if (pip.reducedMotion) {
      reactionLedger.spend(reaction.id);
      return;
    }
    if (!reactionLedger.start(reaction.id)) return;
    driver.react(reaction);
    canvas.setAttribute("data-scene-pip-reaction", reaction.id);
    canvas.setAttribute("data-scene-pip-reaction-kind", reaction.kind);
    canvas.setAttribute("data-scene-pip-intensity", String(reaction.intensity));
    invalidate();
  }, [holding, reaction, pip.reducedMotion, driver, canvas, invalidate]);

  useEffect(() => {
    canvas.setAttribute("data-scene-pip", holding ? "shown" : "ready");
    invalidate();
  }, [canvas, holding, invalidate]);

  // The phone draws only when something moves: Pip's box moving moves him.
  useEffect(() => {
    if (tier !== "phone") return;
    const moved = () => {
      invalidate();
    };
    const options = { capture: true, passive: true } as const;
    window.addEventListener("scroll", moved, options);
    window.addEventListener("resize", moved);
    const resized = new ResizeObserver(moved);
    resized.observe(document.body);
    return () => {
      window.removeEventListener("scroll", moved, options);
      window.removeEventListener("resize", moved);
      resized.disconnect();
    };
  }, [tier, invalidate]);
  useEffect(() => {
    invalidate();
  }, [screen, invalidate]);

  // Whether the director last heard Pip is seen, while the Scene holds him.
  const seen = useRef<boolean | null>(null);
  useEffect(() => {
    seen.current = holding ? true : null;
  }, [holding]);
  const marks = useRef("");
  const lastSpot = useRef("");
  // Stopping (a Lesson's step), the Scene's loop stops on its last frame,
  // which shows again when the Scene comes back: that frame is drawn now
  // without Pip, so it never shows him beside the screen's own Pip.
  const get = useThree((s) => s.get);
  useLayoutEffect(() => {
    const place = group.current;
    if (!stopped || place === null) return;
    place.visible = false;
    canvas.setAttribute("data-scene-pip-visible", "false");
    marks.current = "";
    const { gl, scene, camera } = get();
    gl.render(scene, camera);
  }, [stopped, canvas, get]);
  // Whether Pip still moved at the end of the last frame drawn.
  const wasMoving = useRef(false);

  useFrame((state, delta) => {
    const place = group.current;
    if (place === null) return;
    const el = findPipSpot();
    const rect = el?.getBoundingClientRect() ?? null;
    const { size } = state;
    const box =
      rect === null
        ? null
        : {
            x: rect.x - size.left,
            y: rect.y - size.top,
            width: rect.width,
            height: rect.height,
          };
    const shows = box !== null && spotShows(box, size.width, size.height);
    // Only the box the screen's Pip leaves standing down: while his own
    // Pip still draws there, the 3D one waits.
    const handedOver = el?.hasAttribute("data-pip-stood-down") === true;
    const drawn3d = shows && !stopped && holding && handedOver;
    if (box !== null)
      placeAtSpot(place, state.camera as PerspectiveCamera, box, size, height);
    if (!drawn) {
      // The measuring frame: his materials compile here, hidden, so the
      // frame that first shows him has nothing left to build.
      place.visible = true;
      state.gl.compile(place, state.camera, state.scene);
    }
    place.visible = drawn3d;
    driver.update(frameStep(delta, wasMoving.current));
    wasMoving.current = driver.moving();

    if (seen.current !== null && seen.current !== shows) {
      seen.current = shows;
      send({ type: "onScreen", visible: shows });
    }
    const now = driver.state();
    const next = [
      now.mode,
      now.still ? "still" : "",
      `${now.gaze.x.toFixed(2)} ${now.gaze.y.toFixed(2)}`,
      `${now.gazeTo.x.toFixed(2)} ${now.gazeTo.y.toFixed(2)}`,
      String(drawn3d),
      now.reaction === null ? "" : "playing",
    ];
    const key = next.join("|");
    if (key !== marks.current) {
      marks.current = key;
      const [
        mode = "",
        still = "",
        gaze = "",
        gazeTo = "",
        visible = "",
        playing = "",
      ] = next;
      canvas.setAttribute("data-scene-pip-mode", mode);
      canvas.toggleAttribute("data-scene-pip-still", still !== "");
      canvas.setAttribute("data-scene-pip-gaze", gaze);
      canvas.setAttribute("data-scene-pip-gaze-to", gazeTo);
      canvas.setAttribute("data-scene-pip-visible", visible);
      canvas.toggleAttribute("data-scene-pip-playing", playing !== "");
    }
    if (!drawn) setDrawn(true);
    const spot =
      box === null
        ? ""
        : `${String(box.x)} ${String(box.y)} ${String(box.width)} ${String(box.height)} ${String(handedOver)}`;
    // The phone draws again while Pip moves, his box moves, or the screen's
    // Pip has yet to stand down for him.
    const waiting = holding && !handedOver && box !== null;
    if (
      tier === "phone" &&
      (wasMoving.current || waiting || spot !== lastSpot.current)
    )
      invalidate();
    lastSpot.current = spot;
  });

  return (
    <group ref={group} visible={false}>
      <group position={[-centre.x, -centre.y, -centre.z]}>
        <primitive object={model.scene} />
      </group>
      {holding && <Hold still={pip.reducedMotion} />}
    </group>
  );
}

/**
 * The Scene holds Pip while this is mounted: the screen's own Pip stands
 * down, and Pip follows the mouse from his box, as the screen's Pip did.
 */
function Hold({ still }: { still: boolean }): null {
  useScenePip();
  const send = usePipInput();
  const reduced = useRef(still);
  useEffect(() => {
    reduced.current = still;
  }, [still]);
  useEffect(
    () =>
      followPointer(window, {
        pip: () => findPipSpot(),
        still: () => reduced.current,
        send,
      }),
    [send],
  );
  return null;
}

/** Gives back a model's geometry and materials once nothing draws it. */
function disposeTree(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) material.dispose();
  });
}
