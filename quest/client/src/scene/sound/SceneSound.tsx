import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLiveFeed } from "../../live/LiveProvider";
import { motionTokens } from "../../lib/motion";
import { useMount, useRouteHandle, useScreenPath } from "../../mount/context";
import { screenFor } from "../../pip/screens";
import { useCourseSnapshot } from "../../screens/lesson";
import { useBadgeReveal, type BadgeRevealEvent } from "../badges";
import { SoundContext, useSceneSound } from "./context";
import { createSoundEngine, type SoundEngine, type SoundPlay } from "./engine";

const MS_PER_SECOND = 1000;

/**
 * The Scene's sound (09 9.5), on with the Scene's own switch
 * (`ClientMount.scene`): without it, as in the Local app, this renders its
 * children alone, with no sound, no mute control and no audio. With it, a
 * screen transition plays its cue, cut short by the next one, and a Check
 * passing for the first time plays its own while the Lesson column shows
 * it; the Badge reveal plays its own through `RevealSound`, and the Level
 * run will through `useSceneSound`. A repeated pass plays none, as Pip only
 * nods to it, so a Check clicked again is never rewarded.
 */
export function SceneSound({ children }: { children: ReactNode }): ReactNode {
  const { scene } = useMount();
  if (scene === null) return children;
  return <SoundOn>{children}</SoundOn>;
}

function SoundOn({ children }: { children: ReactNode }): ReactNode {
  const [engine] = useState(createSoundEngine);
  useEffect(() => engine.start(), [engine]);
  useScreenCue(engine);
  useCheckCue(engine);
  return <SoundContext value={engine}>{children}</SoundContext>;
}

/** The screen cue on each route change, when the mount turns screen transitions on. */
function useScreenCue(engine: SoundEngine): void {
  const { transitions } = useMount();
  const path = useScreenPath();
  const last = useRef(path);
  const playing = useRef<SoundPlay | null>(null);
  useEffect(() => {
    if (last.current === path) return;
    last.current = path;
    // A new navigation cuts the last transition's sound short.
    playing.current?.stop();
    playing.current =
      transitions === null
        ? null
        : // Within the Motion standard's cap as it stands now (--duration-slow).
          engine.play("screen", { within: motionTokens().slow });
  }, [engine, path, transitions]);
  useEffect(
    () => () => {
      playing.current?.stop();
    },
    [],
  );
}

/** The Check cue on a first pass, while a Lesson's step shows its Check lines. */
function useCheckCue(engine: SoundEngine): void {
  const feed = useLiveFeed();
  const path = useScreenPath();
  const phase = useCourseSnapshot()?.lesson.phase;
  const handle = useRouteHandle().screen;
  const onStep = screenFor(path, phase, handle) === "step";
  const shows = useRef(onStep);
  useEffect(() => {
    shows.current = onStep;
  }, [onStep]);
  useEffect(
    () =>
      feed.subscribe((events) => {
        const first = events.some(
          (event) => event.type === "check.passed" && event.firstTime,
        );
        if (first && shows.current) engine.play("check");
      }),
    [engine, feed],
  );
}

/**
 * The Badge reveal's cue (09 9.3, 9.5), inside the Scene's hub, where the
 * reveal tells its events (`useBadgeReveal`): a reveal the Scene draws plays
 * "badge-reveal" within the reveal's length, and its skip cuts the cue
 * short. The still tier's cross-fade (`drawn: false`) plays nothing, and a
 * reload, a second tab or a replay tells nothing, so plays nothing. Mute, a
 * hidden page and the Practice terminal's focus or busy mark are the
 * engine's own rules, as for every cue.
 */
export function RevealSound(): null {
  const play = useSceneSound();
  const playing = useRef<{ lesson: string; cue: SoundPlay } | null>(null);
  const follow = useCallback(
    (event: BadgeRevealEvent) => {
      if (event.type === "start") {
        playing.current?.cue.stop();
        playing.current =
          event.drawn && event.ms > 0
            ? {
                lesson: event.lesson,
                cue: play("badge-reveal", { within: event.ms / MS_PER_SECOND }),
              }
            : null;
        return;
      }
      if (playing.current?.lesson !== event.lesson) return;
      // A reveal that ran its length lets its cue's last note fade as written.
      if (event.type === "skip") playing.current.cue.stop();
      playing.current = null;
    },
    [play],
  );
  useBadgeReveal(follow);
  useEffect(
    () => () => {
      playing.current?.cue.stop();
    },
    [],
  );
  return null;
}
