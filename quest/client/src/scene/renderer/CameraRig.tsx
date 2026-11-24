import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PerspectiveCamera } from "three";
import type {
  SceneStation,
  ScreenChange,
  ScreenOnShow,
} from "../../mount/types";
import { motionTokens, type Easing } from "../../lib/motion";
import { SceneContext, useSceneMove, type SceneMove } from "../context";
import { journeyPathOf, type PathView } from "../path";
import {
  aim,
  beginnerStations,
  createCameraMoves,
  cubicBezier,
  placeFor,
  planMove,
  poseOf,
  glideOf,
  pipStation,
  sameView,
  viewOf,
  walkEase,
  type Place,
} from "./camera";
import { beginnerLayout } from "./beginner";

const MS_PER_SECOND = 1000;
/** The desktop's slow sway over the meadow, in radians per second and scene units. */
const SWAY_RATE = 0.06;
const SWAY = 0.8;

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
  /** A desktop sways over the meadow. */
  sway: boolean;
}

/**
 * The Scene's camera (09 9.3): it frames the Journey's path at Pip's
 * Station or the whole Level within the Journey's stage band, dives into a
 * Station behind its Lesson's screens and stands over the meadow elsewhere.
 * A screen change is a move between those places, registered with S11
 * through `useSceneMove`: within the cap, eased by the tokens, started
 * before the new screen's first frame and ended where it stands by a new
 * navigation or at the cap. A new Station or the pull-back on the Journey
 * glides there. Each frame it tells the Journey where every Station and
 * Pip's feet fall on the page.
 */
export function CameraRig({ screen, stations, sway }: Props): null {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const canvas = useThree((s) => s.gl.domElement);
  const path = journeyPathOf(useContext(SceneContext));
  const [moves] = useState(createCameraMoves);
  const shown = useRef<ScreenOnShow>(screen.get());
  const sent = useRef<PathView | null>(null);
  const beginner = useMemo(() => beginnerStations(stations), [stations]);
  const ids = useMemo(() => beginner.map((s) => s.lesson), [beginner]);
  const marks = useMemo(
    () => beginner.map((s) => ({ lesson: s.lesson, lit: s.complete })),
    [beginner],
  );
  useEffect(() => {
    invalidate();
  }, [marks, invalidate]);

  const placeNow = useCallback(
    () =>
      placeFor(
        shown.current,
        { at: path.at(), whole: path.whole(), band: path.band() },
        stations,
      ),
    [path, stations],
  );

  // The Station Pip stands at for a place, and the last frame's shot of him.
  const pipOf = useCallback(
    (place: Place) => pipStation(place, ids.indexOf(path.at() ?? "")),
    [ids, path],
  );
  const lastShot = useRef({ pip: 0, pace: 0 });

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
      const plan = planMove(change, ids);
      // Coming back from a Lesson's screens, Pip stands at its Station.
      if (plan.at !== null) path.setAt(plan.at);
      shown.current = change.to;
      if (!plan.travel) {
        moves.end(performance.now(), poseOf(placeNow(), size));
        canvas.removeAttribute(MOVING);
        return "under";
      }
      const tokens = motionTokens();
      start(tokens.base * MS_PER_SECOND, tokens.inOut, true);
      change.signal.addEventListener("abort", () => {
        // Ended where it stands, unless a new change has taken over.
        if (shown.current !== change.to) return;
        moves.end(performance.now(), poseOf(placeNow(), size));
        canvas.removeAttribute(MOVING);
        invalidate();
      });
      return "under";
    },
    [ids, path, moves, placeNow, size, canvas, start, invalidate],
  );
  useSceneMove(onMove);

  // A new Station on the Journey, in a Station's view or the whole Level's,
  // walks Pip there over --duration-walk, the camera gliding with him; a
  // new Station chosen on the way carries him on at the speed he walks. The
  // pull-back and the way back in glide over --duration-slow. Anything else
  // that changes the place outside a screen change (the band appearing as a
  // page opens on the Journey, a new screen with screen transitions off)
  // shows the new place at once: no move.
  useEffect(() => {
    const standing = () => {
      const place = placeNow();
      return { place, pip: pipOf(place) };
    };
    let last = standing();
    const glide = () => {
      const next = standing();
      const move = glideOf(last, next);
      last = next;
      if (move !== null && !canvas.hasAttribute(MOVING)) {
        const tokens = motionTokens();
        if (move === "walk") {
          const { pip, pace } = lastShot.current;
          const goal = beginnerLayout().shares[next.pip] ?? pip;
          const ease =
            tokens.inOut === "linear"
              ? tokens.inOut
              : walkEase(tokens.inOut, pace, pip, goal, tokens.walk);
          start(tokens.walk * MS_PER_SECOND, ease, false);
        } else start(tokens.slow * MS_PER_SECOND, tokens.inOut, false);
      }
      invalidate();
    };
    const offPath = path.subscribe(glide);
    const offScreen = screen.subscribe(() => {
      shown.current = screen.get();
      glide();
    });
    return () => {
      offPath();
      offScreen();
    };
  }, [path, screen, placeNow, pipOf, canvas, start, invalidate]);

  useEffect(() => {
    path.setReady(true);
    return () => {
      path.setReady(false);
      path.setView({ points: [], pip: null });
    };
  }, [path]);

  useFrame(({ clock }) => {
    const place = placeNow();
    const shot = moves.frame(
      performance.now(),
      poseOf(place, size),
      beginnerLayout().shares[pipOf(place)] ?? 0,
    );
    lastShot.current.pip = shot.pip;
    lastShot.current.pace = shot.pace;
    if (!shot.between) canvas.removeAttribute(MOVING);
    if (shot.moving) invalidate();
    if (sway && place.kind === "meadow")
      shot.pose.position.x += Math.sin(clock.elapsedTime * SWAY_RATE) * SWAY;
    aim(camera, shot.pose, size);
    const view = viewOf(camera, size, marks, shot.pip, shot.walk, shot.pace);
    if (!sameView(sent.current, view)) {
      sent.current = view;
      path.setView(view);
    }
  });
  return null;
}
