// The workshop's Pip (D6, seam S13): the 3D Pip standing in the room, in
// its own world, not in a box of the screen's. He loads his model after
// the Scene has drawn, and holds Pip (S12's useScenePip) only once it has
// passed its contract, loaded and been drawn, so the screen's own Pip
// shows until then, and wherever it fails, and the two never draw
// together. Where the Scene stops he leaves the room and lets Pip go, but
// stays mounted: his model and his place in the room wait for the way
// back, so he holds Pip again at once, where he stood, with no reload.
// The one director still plays his modes and Reactions through the
// guide's driver; his legs are his own: he walks and runs where the
// screen's goal and the workshop's commands send him, round the
// furniture, and the stride lays his steps over the driver's pose. He tells the director only that he travels, and that the
// Learner greeted him, and tells the screens what he is doing, where he
// stands, and where his head is on the page.
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Box3, Group, Mesh, Vector3, type Object3D } from "three";
import type { SceneTheme, SceneTier } from "../../../mount/types";
import { PIP_MODEL_HEAD } from "../../../../pip/model/contract";
import { reactionLedger } from "../../../pip/playback";
import { usePipInput, usePipModel, usePipTravel } from "../../../pip/PipStage";
import { SceneContext, useScenePip } from "../../context";
import { PIP_START, type SpotId } from "../../workshop/layout";
import {
  workshopOf,
  type Anchors,
  type PipCommand,
  type ProbeFoot,
  type Workshop,
} from "../../workshop/store";
import modelUrl from "../../../../pip/model/pip.glb?url";
import { PipDrive, frameStep } from "./drive";
import { loadPipModel, type PipModel3D } from "./load";
import type { Side } from "./motion/gait";
import { workshopNav } from "./motion/nav";
import { StridePose } from "./motion/pose";
import { Walker, activityOf } from "./motion/walker";
import { poseShadow, shadowMesh, tintShadow } from "./shadow";

export interface WorkshopPipProps {
  /** Where the screen wants Pip: a spot of the room, or null to leave him be. */
  goal: SpotId | null;
  /**
   * The screen on show, a new value for each show: each show sends him to
   * its goal, the same goal as the last screen's too, so a command that
   * took him elsewhere never keeps him from where the next screen wants him.
   */
  show: unknown;
  /** Whether he stands in the room; false where the Scene stops, so the screen's own Pip is the one. */
  inRoom: boolean;
  tier: Exclude<SceneTier, "still">;
  /** The Scene's sky, which sets how dark his ground shadow lies. */
  theme: SceneTheme;
  /** His ground shadow's colour: the look's `shadow`. */
  shadow: string;
  /** Where he stands when he first shows; the room's start if none. */
  start?: SpotId;
}

type Loaded =
  { state: "loading" | "failed" } | { state: "ready"; model: PipModel3D };

/** What the workshop's pick finds on him: his root carries it, so a hit on any part of him is Pip. */
const PICK = { pick: { kind: "pip" } } as const;

/**
 * His shadow lies flat on the floor under him: the guide's soft ellipse,
 * which the posters stand him on, laid down and stretched front to back
 * to his footprint, a hair above the floor.
 */
const FLOOR_SHADOW = { across: 1.1, along: 6, lift: 0.01 } as const;

/** Below this share the stride has settled: nothing of it moves him any more. */
const SETTLED = 0.002;

/**
 * Told of a greet, the director's Greeting reaches the driver a render
 * later, if it plays at all (not twice within its nod window): he reads as
 * greeting until it starts, or for this many seconds.
 */
const GREET_ANSWER = 0.5;

/** Pip in the room: his model loading, then walking, or nothing where it fails. */
export function WorkshopPip(props: WorkshopPipProps): ReactNode {
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
  return <InRoom model={loaded.model} {...props} />;
}

function InRoom({
  model,
  goal,
  show,
  inRoom,
  tier,
  theme,
  shadow: shadowColour,
  start,
}: WorkshopPipProps & { model: PipModel3D }): ReactNode {
  const pip = usePipModel();
  const send = usePipInput();
  const workshop = workshopOf(useContext(SceneContext));
  const canvas = useThree((s) => s.gl.domElement);
  const invalidate = useThree((s) => s.invalidate);
  const get = useThree((s) => s.get);
  const root = useRef<Group>(null);
  const [driver] = useState(() => new PipDrive(model.scene, model.clips));
  const [stride] = useState(() => new StridePose(model.scene));
  const [walker] = useState(
    () => new Walker(workshopNav(), start ?? PIP_START),
  );
  useEffect(
    () => () => {
      driver.dispose();
    },
    [driver],
  );
  const [shadow] = useState(() => floorShadow(theme, shadowColour));
  useEffect(
    () => () => {
      disposeTree(shadow.group);
    },
    [shadow],
  );
  useEffect(() => {
    tintShadow(shadow.mesh, shadowColour);
    invalidate();
  }, [shadow, shadowColour, theme, invalidate]);

  const [drawn, setDrawn] = useState(false);
  const shown = drawn && inRoom;
  const [travelling, setTravelling] = useState(false);
  usePipTravel(travelling && inRoom);
  const hold = tier === "phone";
  useEffect(() => {
    driver.set(pip, hold);
    invalidate();
  }, [driver, pip, hold, invalidate]);

  // A Reaction plays once per ID in this tab, as on the Rive rig: one the
  // screen's Pip already played never plays again here.
  const reaction = pip.reaction;
  useLayoutEffect(() => {
    if (reaction !== null) reactionLedger.arrive(reaction.id);
  }, [reaction]);
  useEffect(() => {
    if (!shown || reaction === null) return;
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
  }, [shown, reaction, pip.reducedMotion, driver, canvas, invalidate]);
  useEffect(() => {
    canvas.setAttribute("data-scene-pip", shown ? "shown" : "ready");
    canvas.setAttribute("data-scene-pip-mode", pip.mode);
  }, [canvas, shown, pip.mode]);

  const goalNow = useScreenGoal(walker, goal, show, invalidate);

  // The screens' commands, each replacing what he did at once.
  useEffect(
    () =>
      workshop.onCommand((command: PipCommand) => {
        switch (command.type) {
          case "goTo":
            walker.goTo(command.to, command.pace ?? "auto");
            break;
          case "greet": {
            const at = get().camera.position;
            walker.greet({ x: at.x, z: at.z });
            break;
          }
          case "steer":
            walker.steer(command.x, command.z, command.run);
            break;
          case "explore":
            walker.setExplore(command.on, goalNow.current);
            break;
          case "stop":
            walker.stop();
            break;
        }
        invalidate();
      }),
    [workshop, walker, get, invalidate, goalNow],
  );

  // Gone, he leaves no anchor behind.
  useEffect(
    () => () => {
      workshop.setAnchors(withoutPip(workshop.anchors()));
    },
    [workshop],
  );
  // Out of the room, the Scene's loop stops on its last frame, which shows
  // again when the Scene comes back: that frame is drawn now without him,
  // so it never shows him beside the screen's own Pip.
  useLayoutEffect(() => {
    if (inRoom) return;
    const place = root.current;
    if (place !== null) place.visible = false;
    workshop.setAnchors(withoutPip(workshop.anchors()));
    const { gl, scene, camera } = get();
    gl.render(scene, camera);
  }, [inRoom, workshop, get]);

  const holding = useRef(false);
  const onHold = useCallback((held: boolean) => {
    holding.current = held;
  }, []);
  // Whether the camera sees him, for the director: told only as it changes.
  const [inView, setInView] = useState(true);
  const inViewNow = useRef(true);
  const travelled = useRef(false);
  const wasMoving = useRef(false);
  const clock = useRef(0);
  /** Seconds left to wait for the director's Greeting after telling it of a greet. */
  const greetAnswer = useRef(0);
  const [head] = useState(() => new Vector3());
  const [headRise] = useState(
    () => new Vector3(0, riseToHeadTop(model.scene), 0),
  );
  const [feetAt] = useState(() => [new Vector3(), new Vector3()] as const);

  useFrame((state, delta) => {
    const place = root.current;
    if (place === null || !inRoom) return;
    const dt = frameStep(delta, wasMoving.current);
    clock.current += dt;

    // The clips first, over what the stride moved given back; then the
    // stride over them.
    stride.restore();
    driver.update(dt);
    const frame = walker.update(dt);
    const driven = driver.state();
    stride.apply(dt, place, {
      root: frame.root,
      gait: walker.gait,
      out: frame.out,
      look: frame.look,
      reacting: driven.reaction !== null,
    });
    if (frame.greet) {
      send({ type: "greet" });
      greetAnswer.current = GREET_ANSWER;
    } else if (driven.reaction !== null) greetAnswer.current = 0;
    else greetAnswer.current = Math.max(0, greetAnswer.current - dt);
    poseShadow(shadow.mesh, {
      lift: stride.hopLift(),
      sleep: driver.modeShare("sleep"),
      theme,
    });

    if (!drawn) {
      // The measuring frame: his materials compile here, hidden, so the
      // frame that first shows him has nothing left to build.
      place.visible = true;
      state.gl.compile(place, state.camera, state.scene);
      setDrawn(true);
    }
    place.visible = holding.current;

    if (frame.travelling !== travelled.current) {
      travelled.current = frame.travelling;
      setTravelling(frame.travelling);
    }
    workshop.setStatus({
      activity: activityOf({
        moving: frame.moving,
        runWeight: frame.out.runWeight,
        greeting: walker.greetPending || greetAnswer.current > 0,
        mode: driven.mode,
        reaction: driven.reaction?.kind ?? null,
      }),
      at: walker.at,
    });
    const seen = publishHead(
      workshop,
      stride.headWorld(head).add(headRise),
      holding.current,
      state,
    );
    if (seen !== inViewNow.current) {
      inViewNow.current = seen;
      setInView(seen);
    }

    const probe = workshop.probe?.();
    if (probe) {
      const { pos, vel, yaw } = frame.root;
      const [left, right] = walker.gait.feet;
      probe({
        t: clock.current,
        x: pos.x,
        z: pos.z,
        speed: Math.hypot(vel.x, vel.z),
        airborne: frame.out.airborne,
        facing: yaw,
        feet: [
          drawnFoot(stride, left, feetAt[0]),
          drawnFoot(stride, right, feetAt[1]),
        ],
      });
    }

    wasMoving.current =
      driver.moving() ||
      frame.travelling ||
      frame.out.stepping > 0 ||
      walker.greetPending ||
      greetAnswer.current > 0 ||
      stride.weight() > SETTLED;
    // The phone draws again while he moves or a Reaction plays.
    if (tier === "phone" && (wasMoving.current || !holding.current))
      invalidate();
  });

  return (
    <group ref={root} visible={false} userData={PICK}>
      <primitive object={model.scene} />
      <primitive object={shadow.group} />
      {shown && <Hold onHold={onHold} visible={inView} />}
    </group>
  );
}

/**
 * The screen's goal, on each show and each new goal, sends him there,
 * unless Explore steers him; the goal as it stands now, for Explore's end.
 */
export function useScreenGoal(
  walker: Pick<Walker, "explore" | "goTo">,
  goal: SpotId | null,
  show: unknown,
  invalidate: () => void,
): { readonly current: SpotId | null } {
  const goalNow = useRef(goal);
  useEffect(() => {
    goalNow.current = goal;
    if (goal !== null && !walker.explore) walker.goTo({ spot: goal });
    invalidate();
  }, [goal, show, walker, invalidate]);
  return goalNow;
}

/** The Scene holds Pip while this is mounted: the screen's own Pip stands down, and he shows; the director hears whether the camera sees him. */
function Hold({
  onHold,
  visible,
}: {
  onHold: (held: boolean) => void;
  visible: boolean;
}): null {
  useScenePip(visible);
  useEffect(() => {
    onHold(true);
    return () => {
      onHold(false);
    };
  }, [onHold]);
  return null;
}

/** A ray passes through his shadow. */
function noHit(): void {
  // Nothing of him is hit here.
}

/** His shadow, laid on the floor: the guide's ellipse in a group that lays it down. */
function floorShadow(
  theme: SceneTheme,
  colour: string,
): { group: Group; mesh: Mesh } {
  const mesh = shadowMesh(theme, colour);
  mesh.position.set(0, 0, 0);
  // Inside his picked root, yet a tap on the floor round his feet is the floor's.
  mesh.raycast = noHit;
  const group = new Group();
  group.name = "PipFloorShadow";
  group.rotation.x = -Math.PI / 2;
  group.position.y = FLOOR_SHADOW.lift;
  group.scale.set(FLOOR_SHADOW.across, FLOOR_SHADOW.along, 1);
  group.add(mesh);
  return { group, mesh };
}

/** A foot for the probe: where the model draws it, so a slide the stride lets through shows, and whether the gait stands it. */
function drawnFoot(
  stride: StridePose,
  foot: { side: Side; planted: boolean },
  at: Vector3,
): ProbeFoot {
  stride.footWorld(foot.side, at);
  return { x: at.x, y: at.y, z: at.z, planted: foot.planted };
}

const onPage = new Vector3();

/**
 * How far the top of his head stands above its node, in the Scene's units,
 * as the model rests: his anchor is the top of his head, so what the page
 * hangs over him (his bubble) clears his face.
 */
function riseToHeadTop(model: Object3D): number {
  const head = model.getObjectByName(PIP_MODEL_HEAD);
  if (head === undefined) return 0;
  model.updateMatrixWorld(true);
  const top = new Box3().setFromObject(head).max.y;
  return Math.max(0, top - head.getWorldPosition(new Vector3()).y);
}

/**
 * Publishes where the top of his head falls on the page, beside the room's
 * own anchors, hidden until he shows; and says whether the camera sees it.
 */
function publishHead(
  workshop: Workshop,
  headWorld: Vector3,
  shown: boolean,
  state: {
    camera: Parameters<Vector3["project"]>[0];
    size: { width: number; height: number; left: number; top: number };
  },
): boolean {
  const p = onPage.copy(headWorld).project(state.camera);
  const { size } = state;
  const inView =
    p.z > -1 && p.z < 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
  workshop.setAnchors({
    ...workshop.anchors(),
    pip: {
      x: size.left + ((p.x + 1) / 2) * size.width,
      y: size.top + ((1 - p.y) / 2) * size.height,
      visible: shown && inView,
    },
  });
  return inView;
}

function withoutPip(anchors: Anchors): Anchors {
  return Object.fromEntries(
    Object.entries(anchors).filter(([id]) => id !== "pip"),
  );
}

/** Gives back a tree's geometry and materials once nothing draws it. */
function disposeTree(tree: Object3D): void {
  tree.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const mesh = object as Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) material.dispose();
  });
}
