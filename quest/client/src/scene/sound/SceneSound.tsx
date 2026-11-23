import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLiveFeed } from "../../live/LiveProvider";
import { motionTokens } from "../../lib/motion";
import { useMount, useRouteHandle, useScreenPath } from "../../mount/context";
import { screenFor } from "../../pip/screens";
import { useCourseSnapshot } from "../../screens/lesson";
import { SoundContext } from "./context";
import { createSoundEngine, type SoundEngine, type SoundPlay } from "./engine";

/**
 * The Scene's sound (09 9.5), on with the Scene's own switch
 * (`ClientMount.scene`): without it, as in the Local app, this renders its
 * children alone, with no sound, no mute control and no audio. With it, a
 * screen transition plays its cue, cut short by the next one, and a Check
 * passing for the first time plays its own while the Lesson column shows
 * it; the Badge reveal and the Level run play theirs through
 * `useSceneSound`. A repeated pass plays none, as Pip only nods to it, so a
 * Check clicked again is never rewarded.
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
