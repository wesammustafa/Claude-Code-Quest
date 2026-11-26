import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Raycaster,
  Vector2,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import type {
  SceneStation,
  ScreenChange,
  ScreenOnShow,
} from "../../mount/types";
import { motionTokens, type Easing } from "../../lib/motion";
import { SceneContext, useSceneMove, type SceneMove } from "../context";
import { journeyPathOf, type PathView } from "../path";
import { workshopPlaces } from "../workshop/places";
import { workshopOf } from "../workshop/store";
import {
  aim,
  createCameraMoves,
  cubicBezier,
  framingFor,
  planMove,
  poseOf,
  sameFraming,
  sameView,
  type PathState,
} from "./camera";
import { tellPage, toldCards } from "./workshop/anchors";
import { floorHit, pickOf } from "./workshop/pick";

const MS_PER_SECOND = 1000;
/** The desktop's slow sway over the whole room, in radians per second and scene units. */
const SWAY_RATE = 0.06;
const SWAY = 0.45;

const easingOf = (e: Easing) =>
  e === "linear" ? (t: number) => t : cubicBezier(...e);

/** The attribute the canvas carries while a camera move between screens runs, which the Motion standard's checks watch. */
export const MOVING = "data-scene-moving";

interface Props {
  /** The screen on show, read as it changes rather than rendered. */
  screen: {
    get: () => ScreenOnShow;
    subscribe: (fn: () => void) => () => void;
  };
  stations: readonly SceneStation[];
  /** A desktop sways gently over the whole room. */
  sway: boolean;
  /**
   * Tells today's Journey stage where Pip's feet stand, for the 2D Pip it
   * floats there: only while the Scene draws no 3D Pip, who stands in the
   * room himself.
   */
  feet: boolean;
}

/**
 * The Scene's camera in the workshop (the warm workshop, D5): it frames the
 * whole room, a Level's place (beside a screen's panel on a Lesson's
 * overview) or close on a place, as each screen asks, and on today's
 * Journey stage the card of Pip's Station, or its whole place pulled back,
 * in the stage's band. A screen change is a move between framings,
 * registered with S11 through `useSceneMove`: within the cap, eased by the
 * tokens, started before the new screen's first frame and ended where it
 * stands by a new navigation or at the cap. On the Journey, a new Station
 * walks Pip there over --duration-walk, the camera gliding with him, and
 * the pull-back or a new place glides over --duration-slow. Each frame it
 * tells the page where the places and the cards fall (the workshop's
 * anchors, beside the 3D Pip's own, and today's Journey stage), with Pip's
 * feet on the stage when asked, and it answers the page's pick while it is
 * mounted.
 */
export function CameraRig({ screen, stations, sway, feet }: Props): null {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  const get = useThree((s) => s.get);
  const hub = useContext(SceneContext);
  const path = journeyPathOf(hub);
  const workshop = workshopOf(hub);
  const [moves] = useState(createCameraMoves);
  const shown = useRef<ScreenOnShow>(screen.get());
  const sent = useRef<PathView | null>(null);
  const drawn = useRef(false);
  const places = useMemo(() => workshopPlaces(stations), [stations]);
  const placeIds = useMemo(() => places.map((p) => p.id), [places]);
  const cards = useMemo(() => toldCards(places), [places]);
  useEffect(() => {
    invalidate();
  }, [cards, invalidate]);

  const pathNow = useCallback(
    (): PathState => ({
      at: path.at(),
      whole: path.whole(),
      band: path.band(),
    }),
    [path],
  );
  const framingNow = useCallback(
    () => framingFor(shown.current, pathNow(), places),
    [pathNow, places],
  );

  const start = useCallback(
    (ms: number, ease: Easing, between: boolean) => {
      moves.start(performance.now(), ms, easingOf(ease), between);
      if (between) canvas.setAttribute(MOVING, "");
      invalidate();
    },
    [moves, canvas, invalidate],
  );

  const onMove = useCallback<SceneMove>(
    (change: ScreenChange) => {
      const plan = planMove(change, pathNow(), places);
      // Coming back from a Lesson's screens, the Journey stands at its Lesson.
      if (plan.at !== null) path.setAt(plan.at);
      shown.current = change.to;
      if (!plan.travel) {
        moves.end(performance.now(), poseOf(framingNow(), size));
        canvas.removeAttribute(MOVING);
        return "under";
      }
      const tokens = motionTokens();
      start(tokens.base * MS_PER_SECOND, tokens.inOut, true);
      change.signal.addEventListener("abort", () => {
        // Ended where it stands, unless a new change has taken over.
        if (shown.current !== change.to) return;
        moves.end(performance.now(), poseOf(framingNow(), size));
        canvas.removeAttribute(MOVING);
        invalidate();
      });
      return "under";
    },
    [path, pathNow, places, moves, framingNow, size, canvas, start, invalidate],
  );
  useSceneMove(onMove);

  // On the Journey, a new Station on the stage walks Pip there over
  // --duration-walk; the pull-back, the way back in and a new place glide
  // over --duration-slow. Anything else that changes the framing outside a
  // screen change (the stage's band appearing as the Journey opens, or
  // going, a new screen with screen transitions off) shows it at once.
  useEffect(() => {
    let last = framingNow();
    const offPath = path.subscribe(() => {
      const next = framingNow();
      if (
        !sameFraming(last, next) &&
        (last.kind === "stage") === (next.kind === "stage") &&
        shown.current.screen === "map" &&
        !canvas.hasAttribute(MOVING)
      ) {
        const tokens = motionTokens();
        const walks =
          last.kind === "stage" &&
          next.kind === "stage" &&
          last.card.lesson !== next.card.lesson;
        start(
          (walks ? tokens.walk : tokens.slow) * MS_PER_SECOND,
          tokens.inOut,
          false,
        );
      }
      last = next;
      invalidate();
    });
    const offScreen = screen.subscribe(() => {
      shown.current = screen.get();
      last = framingNow();
      invalidate();
    });
    return () => {
      offPath();
      offScreen();
    };
  }, [path, screen, framingNow, canvas, start, invalidate]);

  // Ready once a frame is drawn; gone, the page shows nothing that rides on the Scene.
  useEffect(() => {
    drawn.current = false;
    return () => {
      workshop.setReady(false);
      workshop.setAnchors({});
      path.setReady(false);
      path.setView({ points: [], pip: null });
      sent.current = null;
    };
  }, [workshop, path]);

  // The page's pick: what the ray from the camera through a point of the
  // page meets first that is tagged, else the floor inside the room.
  useEffect(() => {
    const ray = new Raycaster();
    const ndc = new Vector2();
    return workshop.setPick((clientX, clientY) => {
      const { camera: eye, scene, gl } = get();
      const box = gl.domElement.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return null;
      ndc.set(
        ((clientX - box.left) / box.width) * 2 - 1,
        1 - ((clientY - box.top) / box.height) * 2,
      );
      ray.setFromCamera(ndc, eye);
      const tagged: Object3D[] = [];
      scene.traverse((o) => {
        if (o.userData.pick !== undefined) tagged.push(o);
      });
      return pickOf(
        ray.intersectObjects(tagged, true),
        floorHit(ray.ray.origin, ray.ray.direction),
      );
    });
  }, [workshop, get]);

  useFrame(({ clock }) => {
    const framing = framingNow();
    const shot = moves.frame(performance.now(), poseOf(framing, size));
    if (!shot.between) canvas.removeAttribute(MOVING);
    if (shot.moving) invalidate();
    if (sway && (framing.kind === "room" || framing.kind === "welcome"))
      shot.pose.position.x += Math.sin(clock.elapsedTime * SWAY_RATE) * SWAY;
    aim(camera, shot.pose, size);
    const told = tellPage(
      camera,
      size,
      placeIds,
      cards,
      feet ? shot.pose.pip : null,
    );
    // The 3D Pip publishes his own anchor; the room's leave it be.
    const pip = workshop.anchors().pip;
    workshop.setAnchors(
      pip === undefined ? told.anchors : { ...told.anchors, pip },
    );
    if (!sameView(sent.current, told.view)) {
      sent.current = told.view;
      path.setView(told.view);
    }
    if (!drawn.current) {
      drawn.current = true;
      workshop.setReady(true);
      path.setReady(true);
    }
  });
  return null;
}
