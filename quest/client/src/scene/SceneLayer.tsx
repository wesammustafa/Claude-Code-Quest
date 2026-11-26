import {
  Component,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx";
import { motionReduced, usePageHidden, useResolvedTheme } from "../lib/page";
import { afterFirstPaint } from "../lib/paint";
import type { LevelId, Snapshot } from "@quest/contract";
import type {
  SceneMount,
  SceneProps,
  SceneStation,
  ScreenOnShow,
} from "../mount/types";
import { usePipInput } from "../pip/PipStage";
import type { PipScreen } from "../pip/screen-name";
import { useCourseSnapshot } from "../screens/lesson";
import { tokenMs, useBadgeReveal } from "./badges";
import { SceneContext } from "./context";
import { lessonOfScreen } from "./path";
import { useSceneTier } from "./tier";
import { cardPinsOf } from "./workshop/pin";

/** The screens the Scene stops on: a Lesson's step, a Step-down included (09 9.2). */
export function sceneStops(screen: PipScreen): boolean {
  return screen === "step" || screen === "levelup";
}

type Renderer = ComponentType<SceneProps>;

/** The renderer as it stands: not loaded yet, loaded, or failed for good. */
type Loaded =
  { state: "waiting" | "failed" } | { state: "loaded"; View: Renderer };

interface Props {
  scene: SceneMount;
  screen: ScreenOnShow;
  /** Called when the Scene starts or stops showing a still or a drawn frame, so the frame drops or keeps its own background. */
  onShown: (shown: boolean) => void;
}

/**
 * Seam S12: the Scene's layer, rendered once by the shell outside the keyed
 * screen, so it persists across navigation. It sits fixed behind the page,
 * `aria-hidden` and `inert`, so the screens stay the keyboard and screen
 * reader path and nothing in it takes focus. The renderer loads after the
 * first paint the first time a screen that shows the Scene is on show, and
 * fades in once it has drawn a frame; until then, and if it never comes,
 * the screens look as they do without it. On a Lesson's step, a Step-down
 * included, and while the page is hidden its render loop is stopped; on
 * the step it is hidden too. Its loaded renderer is kept while stopped, so
 * the way back draws again with no reload. The still tier, a renderer that
 * fails to load or throws, and a lost WebGL context show the mount's still
 * image instead, or nothing where there is none.
 */
export function SceneLayer({ scene, screen, onShown }: Props): ReactNode {
  const tier = useSceneTier();
  const theme = useResolvedTheme();
  const hidden = usePageHidden();
  const snapshot = useCourseSnapshot();
  const lesson = snapshot?.lesson ?? null;
  const stations = useStagedStations(useStations(snapshot), screen);
  const stopped = sceneStops(screen.screen);
  const [loaded, setLoaded] = useState<Loaded>({ state: "waiting" });
  const [lost, setLost] = useState(false);
  // Where the Scene draws, or will once it loads, it stages a first
  // completion: the card's pin, then Pip's Celebration.
  useStagesCompletion(tier !== "still" && !lost && loaded.state !== "failed");

  const wanted = tier !== "still" && !stopped && !lost;
  const started = useRef(false);
  const { load } = scene;
  useEffect(() => {
    if (!wanted || started.current) return;
    // Cancelled before it runs, it has not started, and the next screen that wants it starts it.
    return afterFirstPaint(() => {
      started.current = true;
      load().then(
        (module) => {
          setLoaded({ state: "loaded", View: module.default });
        },
        () => {
          setLoaded({ state: "failed" });
        },
      );
    });
  }, [wanted, load]);

  const onLost = useCallback(() => {
    setLost(true);
  }, []);

  const View = loaded.state === "loaded" ? loaded.View : null;
  // A still stands in for the drawn Scene where it cannot or should not run.
  const fallback = tier === "still" || lost || loaded.state === "failed";
  const still = fallback ? (scene.still?.({ screen, theme }) ?? null) : null;
  // Neither shows: the frame keeps its own background.
  const empty = (tier === "still" || lost || View === null) && still === null;
  useEffect(() => {
    if (empty) onShown(false);
  }, [empty, onShown]);

  return (
    <div
      data-scene=""
      data-scene-tier={tier}
      {...(stopped ? { "data-scene-stopped": "" } : {})}
      aria-hidden="true"
      inert
      className={cx(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        stopped && "invisible",
      )}
    >
      {/* The frame's own background, under the Scene while it fades in. */}
      <div className="absolute inset-0 bg-bg bg-(image:--glow) bg-no-repeat" />
      {tier !== "still" && !lost && View !== null ? (
        <Drawn
          // A tier's context attributes (antialiasing, power) are set only
          // when its renderer is made: a new tier makes a new one.
          key={tier}
          View={View}
          onShown={onShown}
          screen={screen}
          lesson={lesson?.id ?? null}
          phase={lesson?.phase ?? null}
          step={lesson?.phase === "playing" ? (lesson.step?.id ?? null) : null}
          stations={stations}
          tier={tier}
          running={!stopped && !hidden}
          theme={theme}
          look={scene.look[theme]}
          onLost={onLost}
          pip={scene.pip === true}
        />
      ) : (
        still !== null && <Still key={still} src={still} onShown={onShown} />
      )}
    </div>
  );
}

const NO_STATIONS: readonly SceneStation[] = [];

/**
 * Every Lesson of the course as its Station, in the snapshot's order, from
 * its `LessonSummary.optional` and `complete` alone; the same array until
 * one of those changes, so a new snapshot draws nothing new. An optional
 * Lesson (a lab) is marked so: its card comes after its Level's core
 * Lessons' at their place, and looks its own.
 */
function useStations(snapshot: Snapshot | null): readonly SceneStation[] {
  const key =
    snapshot?.course.levels
      .flatMap((level) =>
        level.lessons.map(
          (l) =>
            `${level.id}:${l.id}:${l.optional ? "1" : "0"}:${l.complete ? "1" : "0"}`,
        ),
      )
      .join(",") ?? "";
  return useMemo(
    () =>
      key === ""
        ? NO_STATIONS
        : key.split(",").map((entry) => {
            const [level = "", id = "", lab = "0", done = "0"] =
              entry.split(":");
            return {
              level: level as LevelId,
              lesson: id,
              optional: lab === "1",
              complete: done === "1",
            };
          }),
    [key],
  );
}

/** Tells the director whether the Scene stages a first completion, and that it no longer does once the layer goes. */
function useStagesCompletion(on: boolean): void {
  const send = usePipInput();
  useEffect(() => {
    send({ type: "sceneStages", on });
  }, [send, on]);
  useEffect(
    () => () => {
      send({ type: "sceneStages", on: false });
    },
    [send],
  );
}

/**
 * The Stations as the renderer draws them, and the card's pin (09 9.3; the
 * warm workshop, D5, D10). A Lesson completed in this tab, on its own
 * screens, stays unlit from its completion; so does one whose Badge reveal
 * starts, which only the tab that won its lesson.completed milestone plays,
 * once the save has landed. At the reveal's end or skip its card pins: the
 * moment runs over --duration-moment (at once under reduced motion), then
 * the director hears `pinned` and Pip celebrates. Leaving that Lesson's
 * screens lights it with no pin and no Celebration. A Lesson already
 * complete when the page first hears of it, as after a reload or on a
 * replay, is lit at once.
 */
function useStagedStations(
  stations: readonly SceneStation[],
  screen: ScreenOnShow,
): readonly SceneStation[] {
  const [before, setBefore] = useState(stations);
  const [held, setHeld] = useState<string | null>(null);
  const on = lessonOfScreen(screen);
  if (before !== stations) {
    setBefore(stations);
    const done = stations.find(
      (s) =>
        s.complete &&
        s.lesson === on &&
        before.some((b) => b.lesson === s.lesson && !b.complete),
    );
    if (done !== undefined) setHeld(done.lesson);
  }
  if (held !== null && on !== held) setHeld(null);
  const pins = cardPinsOf(useContext(SceneContext));
  const send = usePipInput();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNow = useRef(on);
  useEffect(() => {
    onNow.current = on;
    if (pins.now()?.lesson === on) return;
    // A pin left behind with its Lesson's screens ends unplayed.
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pins.set(null);
  }, [on, pins]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      pins.set(null);
    },
    [pins],
  );
  useBadgeReveal((event) => {
    if (event.lesson !== onNow.current) return;
    if (event.type === "start") {
      setHeld(event.lesson);
      return;
    }
    setHeld((h) => (h === event.lesson ? null : h));
    const ms = motionReduced() ? 0 : tokenMs("--duration-moment");
    if (timer.current !== null) clearTimeout(timer.current);
    pins.set({ lesson: event.lesson, startedAt: performance.now(), ms });
    timer.current = setTimeout(() => {
      timer.current = null;
      pins.set(null);
      send({ type: "pinned" });
    }, ms);
  });
  return useMemo(
    () =>
      held === null
        ? stations
        : stations.map((s) =>
            s.lesson === held ? { ...s, complete: false } : s,
          ),
    [stations, held],
  );
}

const FADE =
  "absolute inset-0 transition-opacity duration-(--duration-slow) ease-out";

/** Tells the frame whether this part shows, and that it no longer does once it goes. */
function useShown(shown: boolean, onShown: (shown: boolean) => void): void {
  useEffect(() => {
    onShown(shown);
  }, [shown, onShown]);
  useEffect(
    () => () => {
      onShown(false);
    },
    [onShown],
  );
}

/** The renderer, faded in once it has drawn its first frame. */
function Drawn({
  View,
  onShown,
  ...props
}: Omit<SceneProps, "onReady"> & {
  View: Renderer;
  onShown: (shown: boolean) => void;
}): ReactNode {
  const [ready, setReady] = useState(false);
  useShown(ready, onShown);
  const onReady = useCallback(() => {
    setReady(true);
  }, []);
  return (
    <div className={cx(FADE, ready ? "opacity-100" : "opacity-0")}>
      <Guard onError={props.onLost}>
        <View {...props} onReady={onReady} />
      </Guard>
    </div>
  );
}

/** A still image of the place, faded in once it has loaded; one that fails leaves nothing. */
function Still({
  src,
  onShown,
}: {
  src: string;
  onShown: (shown: boolean) => void;
}): ReactNode {
  const [loaded, setLoaded] = useState(false);
  useShown(loaded, onShown);
  return (
    <img
      data-scene-still=""
      src={src}
      alt=""
      decoding="async"
      onLoad={() => {
        setLoaded(true);
      }}
      onError={() => {
        setLoaded(false);
      }}
      className={cx(
        FADE,
        "size-full object-cover",
        loaded ? "opacity-100" : "opacity-0",
      )}
    />
  );
}

/** Keeps a renderer that throws (a WebGL context it cannot make) from taking the screens with it. */
class Guard extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
