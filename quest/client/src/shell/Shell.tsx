import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Outlet } from "react-router";
import { Notice, type NoticeKind } from "../components/Notice";
import { cx } from "../lib/cx";
import { useHeightProperty } from "../lib/height-property";
import { useMotionTokens } from "../lib/motion";
import { LiveProvider, useConnection } from "../live/LiveProvider";
import type { Connection } from "../live/store";
import {
  RouteHandleContext,
  useMatchedHandle,
  useMount,
  useRouteHandle,
  useScreenPath,
  useTrailingSlash,
} from "../mount/context";
import type { ScreenTransitions } from "../mount/types";
import { PagePanelProvider } from "../pages/PagePanel";
import { PipStageProvider } from "../pip/PipStage";
import { screenFor } from "../pip/screens";
import { PendingMoment } from "../screens/LevelComplete";
import { useCourseSnapshot } from "../screens/lesson";
import { useLessonRoute } from "../screens/useLessonRoute";
import { createSceneHub, SceneContext } from "../scene/context";
import { SceneLayer, sceneStops } from "../scene/SceneLayer";
import { SceneSound } from "../scene/sound/SceneSound";
import { SoundCorner } from "../scene/sound/SoundToggle";
import { MountNotices } from "./MountNotices";
import { enterClass, ScreenChanges } from "./ScreenChanges";
import { SaveNotices } from "./SaveNotices";
import { TopBar } from "./TopBar";

/** How long the wait for the first snapshot lasts before the screen says it is busy, so a snapshot that comes at once shows no flash. */
export const WAITING_MS = 150;

const MS_PER_SECOND = 1000;

const NOTICES: Record<Connection, NoticeKind | null> = {
  waiting: null,
  connected: null,
  reconnecting: "reconnecting",
  stopped: "stopped",
};

/** Whether the page has waited WAITING_MS for its first snapshot and still waits. */
function useLongWait(connection: Connection): boolean {
  const [long, setLong] = useState(false);
  const waiting = connection === "waiting";
  useEffect(() => {
    // The page never waits again once its first snapshot came.
    if (!waiting) return;
    const timer = setTimeout(() => {
      setLong(true);
    }, WAITING_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [waiting]);
  return waiting && long;
}

/**
 * Where the Learner is inside a Lesson's route: its phase, step and beat.
 * Every step and every Step-down share one path, so a change here is a new
 * screen too. Null off a Lesson's route, so a snapshot never moves focus on
 * Welcome, the journey or Progress.
 */
function useLessonPlace(pathname: string): string | null {
  const lesson = useCourseSnapshot()?.lesson;
  if (!lesson || !pathname.startsWith("/lesson/")) return null;
  const at =
    lesson.phase === "playing"
      ? `${lesson.step?.id ?? ""}:${String(lesson.beat?.index ?? "")}`
      : "";
  return `${lesson.id}:${lesson.phase}:${at}`;
}

/**
 * After a new screen (a route change, or a new step, beat or Step-down on
 * the same route) the window scrolls to the top and focus moves to the
 * screen's heading. A screen still waiting for its snapshot has no heading
 * yet, so focus waits for the place to settle and moves then. The first
 * render moves nothing.
 */
function useScreenFocus(
  screen: RefObject<HTMLDivElement | null>,
  pathname: string,
): void {
  const place = useLessonPlace(pathname);
  const last = useRef({ pathname, place });
  const wantsFocus = useRef(false);
  useEffect(() => {
    const before = last.current;
    last.current = { pathname, place };
    const moved =
      before.pathname !== pathname ||
      (before.place !== null && before.place !== place);
    if (moved) {
      window.scrollTo({ top: 0 });
      wantsFocus.current = true;
    }
    if (!wantsFocus.current) return;
    const title =
      screen.current?.querySelector<HTMLElement>("[data-page-title]") ?? null;
    if (title === null) return;
    wantsFocus.current = false;
    title.focus({ preventScroll: true });
  }, [screen, pathname, place]);
}

/** The page's connection, around everything the shell shows, with the Scene's sound where the Scene is on. */
export function Shell() {
  const handle = useMatchedHandle();
  return (
    <RouteHandleContext value={handle}>
      <LiveProvider>
        <PipStageProvider>
          <PagePanelProvider>
            <SceneSound>
              <Frame />
            </SceneSound>
          </PagePanelProvider>
        </PipStageProvider>
      </LiveProvider>
    </RouteHandleContext>
  );
}

/**
 * Every screen's frame: the top bar (left out on Welcome, where Pip and one
 * action stand alone), the connection notice under it, and the screen itself, which
 * enters with a short rise. A mount that turns screen transitions on gets
 * an exit and an enter in place of the rise (ScreenChanges, seam S11). Pip's stage spans every screen, so one director
 * follows the Learner from screen to screen. After a new screen the window scrolls to the top
 * and focus moves to its heading (useScreenFocus). The sticky top's height feeds
 * the page's scroll padding, so focus never lands behind it. Until the first
 * snapshot, once that wait is noticeable, the screen is marked busy
 * (`aria-busy`, `data-connection="waiting"`) for the styles to show. On a
 * Lesson's route the path follows the engine's place (useLessonRoute). On
 * Welcome and the journey a Level or course moment still waiting gets a link.
 * An added route's handle can ask for either screen's frame. A mount that
 * turns the Scene on gets its layer behind the screen, outside the keyed
 * screen so it persists (seam S12); once the Scene shows, the frame paints
 * no background of its own except on a Lesson's step, and the Scene's move
 * plays a screen change ahead of the mount's own.
 */
function Frame(): ReactNode {
  useTrailingSlash();
  const pathname = useScreenPath();
  const handle = useRouteHandle();
  const screen = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  useHeightProperty(top, "--top-height");
  const welcome = pathname === "/" || handle.screen === "welcome";
  const journey = pathname === "/journey" || handle.screen === "journey";
  const connection = useConnection();
  const longWait = useLongWait(connection);
  useLessonRoute();
  useScreenFocus(screen, pathname);
  const { transitions, scene } = useMount();
  const motion = useMotionTokens();
  const phase = useCourseSnapshot()?.lesson.phase;
  const shown = useMemo(
    () => ({
      path: pathname,
      screen: screenFor(pathname, phase, handle.screen),
    }),
    [pathname, phase, handle.screen],
  );
  const [hub] = useState(createSceneHub);
  const [sceneShown, setSceneShown] = useState(false);
  const onSceneShown = useCallback((on: boolean) => {
    setSceneShown(on);
  }, []);
  const clear = scene !== null && sceneShown && !sceneStops(shown.screen);
  const changes = useMemo(
    (): ScreenTransitions | null =>
      transitions === null || scene === null
        ? transitions
        : {
            move: (change) =>
              (hub.move() ?? transitions.move)?.(change) ?? "under",
          },
    [transitions, scene, hub],
  );

  return (
    <SceneContext value={hub}>
      <div
        {...(clear ? { "data-scene-behind": "" } : {})}
        className={cx(
          "min-h-dvh",
          !clear && "bg-bg bg-(image:--glow) bg-no-repeat",
        )}
      >
        {scene !== null && (
          <SceneLayer scene={scene} screen={shown} onShown={onSceneShown} />
        )}
        {/* The top bar and the connection notice under it stay at the top of the window together, outside the animated screen. */}
        <div ref={top} data-top="" className="sticky top-0 z-20">
          {!welcome && <TopBar />}
          <Notice kind={NOTICES[connection]} />
          <SaveNotices />
          <MountNotices />
          {welcome && <SoundCorner />}
        </div>
        <ScreenChanges
          screen={shown}
          live={screen}
          transitions={changes}
          cap={motion.slow * MS_PER_SECOND}
          reduced={motion.reduced}
        >
          <div
            ref={screen}
            key={pathname}
            data-screen=""
            {...(longWait
              ? { "aria-busy": true, "data-connection": "waiting" }
              : {})}
            className={enterClass(transitions)}
          >
            {(welcome || journey) && <PendingMoment />}
            <Outlet />
          </div>
        </ScreenChanges>
      </div>
    </SceneContext>
  );
}
