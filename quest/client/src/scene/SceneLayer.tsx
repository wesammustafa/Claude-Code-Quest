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
  type RefObject,
} from "react";
import { cx } from "../lib/cx";
import { motionReduced, usePageHidden, useResolvedTheme } from "../lib/page";
import { afterFirstPaint } from "../lib/paint";
import type { LessonId, LevelId, Snapshot } from "@quest/contract";
import type {
  SceneMount,
  SceneProps,
  SceneStation,
  ScreenOnShow,
} from "../mount/types";
import { usePipInput } from "../pip/PipStage";
import type { PipScreen } from "../pip/screen-name";
import { hasProgress, useCourseSnapshot } from "../screens/lesson";
import { tokenMs, useBadgeReveal } from "./badges";
import { SceneContext } from "./context";
import { lessonOfScreen } from "./path";
import { useSceneTier } from "./tier";
import { cardPinsOf } from "./workshop/pin";
import { placeOfLesson } from "./workshop/places";
import { workshopOf } from "./workshop/store";

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
  const stopped = sceneStops(screen.screen);
  useDozeOnReturn(snapshot, stopped);
  const [loaded, setLoaded] = useState<Loaded>({ state: "waiting" });
  const [lost, setLost] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pipFailed = usePipModelFailed(root);
  // Where the Scene draws, or will once it loads, it stages a first
  // completion: the card's pin, then Pip's Celebration.
  const stages = tier !== "still" && !lost && loaded.state !== "failed";
  useStagesCompletion(stages);
  // Where its Pip will hold Pip, the pin waits for him to stand at the
  // card, so the Celebration that follows it plays on him, in view, and
  // never on the screen's own Pip.
  const stations = useStagedStations(
    useStations(snapshot),
    screen,
    stages && scene.pip === true && !pipFailed,
  );

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
      ref={root}
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

/**
 * A returning Learner's page that lands where the Scene runs starts with
 * Pip asleep (D7): the director is told once, with the first snapshot, and
 * the first activity wakes him.
 */
function useDozeOnReturn(snapshot: Snapshot | null, stopped: boolean): void {
  const send = usePipInput();
  const told = useRef(false);
  useEffect(() => {
    if (told.current || snapshot === null) return;
    told.current = true;
    if (!stopped && hasProgress(snapshot)) send({ type: "doze" });
  }, [snapshot, stopped, send]);
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
 * Whether the room's Pip failed to load (his model or its contract): the
 * renderer marks its canvas so, and the screen's own Pip stays the one.
 */
function usePipModelFailed(root: RefObject<HTMLElement | null>): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const at = root.current;
    if (at === null) return;
    const read = () => {
      setFailed(at.querySelector('[data-scene-pip="failed"]') !== null);
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(at, {
      subtree: true,
      childList: true,
      attributeFilter: ["data-scene-pip"],
    });
    return () => {
      watch.disconnect();
    };
  }, [root]);
  return failed;
}

/** How long after the reveal the pin waits for Pip to reach the card: as long as a line of his holds. */
const PIN_WAIT = "--says-hold";

/**
 * The Stations as the renderer draws them, and the card's pin (09 9.3; the
 * warm workshop, D5, D10). A Lesson completed in this tab, on its own
 * screens, stays unlit from its completion; so does one whose Badge reveal
 * starts, which only the tab that won its lesson.completed milestone plays,
 * once the save has landed. At the reveal's end or skip its card pins, and
 * where `waitsForPip`, not before the Scene holds Pip and he stands at the
 * card's place: a renderer still loading, as after a reload or a direct
 * entry to a step, brings him in from the room's edge. He gets PIN_WAIT
 * for it; a Pip who never comes (blocked, steered away, his model slow)
 * leaves nothing staged: the card pins then anyway, and he celebrates
 * where he stands, or the Pip on show does. The moment runs
 * over --duration-moment (at once under reduced motion), then the director
 * hears `pinned` and Pip celebrates. Leaving that Lesson's screens lights
 * it with no pin and no Celebration. A Lesson already complete when the
 * page first hears of it, as after a reload or on a replay, is lit at once.
 */
function useStagedStations(
  stations: readonly SceneStation[],
  screen: ScreenOnShow,
  waitsForPip: boolean,
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
  const hub = useContext(SceneContext);
  const pins = cardPinsOf(hub);
  const send = usePipInput();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onNow = useRef(on);
  /** A Lesson whose reveal has ended, its pin waiting for the Scene's Pip at its place. */
  const due = useRef<LessonId | null>(null);
  const waits = useRef(waitsForPip);
  const placed = useRef(stations);
  useEffect(() => {
    placed.current = stations;
  }, [stations]);
  /** The wait for Pip at the due card's place, and whether PIN_WAIT has passed. */
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overdue = useRef(false);
  const stopWaiting = useCallback(() => {
    if (waiting.current !== null) clearTimeout(waiting.current);
    waiting.current = null;
    overdue.current = false;
  }, []);
  const pinDue = useCallback(() => {
    const lesson = due.current;
    if (lesson === null) return;
    if (waits.current && !overdue.current) {
      const place = placeOfLesson(placed.current, lesson);
      const there =
        hub.holdsPip() &&
        (place === null || workshopOf(hub).status().at === place);
      if (!there) {
        waiting.current ??= setTimeout(() => {
          waiting.current = null;
          overdue.current = true;
          retry.current();
        }, tokenMs(PIN_WAIT));
        return;
      }
    }
    stopWaiting();
    due.current = null;
    setHeld((h) => (h === lesson ? null : h));
    const ms = motionReduced() ? 0 : tokenMs("--duration-moment");
    if (timer.current !== null) clearTimeout(timer.current);
    pins.set({ lesson, startedAt: performance.now(), ms });
    timer.current = setTimeout(() => {
      timer.current = null;
      pins.set(null);
      send({ type: "pinned" });
    }, ms);
  }, [hub, pins, send, stopWaiting]);
  const retry = useRef(pinDue);
  useEffect(() => {
    retry.current = pinDue;
  }, [pinDue]);
  useEffect(() => {
    waits.current = waitsForPip;
    pinDue();
  }, [waitsForPip, pinDue]);
  useEffect(() => {
    const stopHold = hub.subscribe(pinDue);
    const stopStatus = workshopOf(hub).subscribeStatus(pinDue);
    return () => {
      stopHold();
      stopStatus();
    };
  }, [hub, pinDue]);
  useEffect(() => {
    onNow.current = on;
    if (due.current !== on) {
      due.current = null;
      stopWaiting();
    }
    if (pins.now()?.lesson === on) return;
    // A pin left behind with its Lesson's screens ends unplayed.
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pins.set(null);
  }, [on, pins, stopWaiting]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      due.current = null;
      stopWaiting();
      pins.set(null);
    },
    [pins, stopWaiting],
  );
  useBadgeReveal((event) => {
    if (event.lesson !== onNow.current) return;
    if (event.type === "start") {
      setHeld(event.lesson);
      return;
    }
    due.current = event.lesson;
    stopWaiting();
    pinDue();
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
