import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { LessonId } from "@quest/contract";
import { Button } from "../components/Button";
import { cx } from "../lib/cx";
import { BOX, PipRenderer } from "../pip/PipRenderer";
import { usePipFollowsPointer, usePipModel } from "../pip/PipStage";
import { useScenePip } from "./context";
import {
  pinchWhole,
  stationAt,
  stepStation,
  swipeStep,
  useJourneyPath,
  wheelWhole,
  type JourneyPath,
  type PathView,
} from "./path";

/** The pull-back control's words (05 5.11): it names the place, never a key. */
export const WHOLE_LEVEL = "Show the whole Level";

/** The paths whose stage has opened once on this page: it opens with a soft rise only the first time. */
const opened = new WeakSet<JourneyPath>();

interface Props {
  /** The Level's Lessons in path order, one Station each. */
  lessons: readonly LessonId[];
  /** Where Pip stands when the Journey names no Station yet: the Learner's place. */
  home: LessonId | null;
  /** Each Lesson's link in the Journey's list, which a Station opens exactly as it does. */
  link: (lesson: LessonId) => HTMLAnchorElement | null;
}

/**
 * The Journey's stage (09 9.3, ticket 52): a band of the page the Scene
 * frames the Level's path in, with the controls a pointer and a finger use
 * on it. A tap on a Station clicks its Lesson's link, so it opens what the
 * link opens and nothing else. A swipe or a drag moves Pip one Station
 * along, and focus moves to that Station's link; a pinch or a scroll pulls
 * back to the whole Level or goes back in, as the control in its corner
 * does. Pip floats over it at the point the Scene draws his feet (9.4),
 * while every screen's own Pip stands down. The Stations' marks are for
 * the pointer alone: the list's links are the keyboard and screen reader
 * path, so the band is hidden from assistive technology but for its
 * control.
 */
export function JourneyStage({ lessons, home, link }: Props): ReactNode {
  const path = useJourneyPath();
  useScenePip();
  const band = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(() => opened.has(path));

  useEffect(() => {
    const at = path.at();
    if (at !== null && lessons.includes(at)) return;
    const first = home !== null && lessons.includes(home) ? home : lessons[0];
    if (first !== undefined) path.setAt(first);
  }, [path, lessons, home]);

  // The band's place on the page, followed as the page scrolls or resizes.
  // It is read once the page is laid out (the observer's first call), never
  // in the commit that mounts the Journey, so the screen's first frame
  // waits on no extra layout (09 9.1).
  useEffect(() => {
    const el = band.current;
    if (el === null) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      path.setBand({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    };
    const resized =
      typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (resized === null) measure();
    else {
      resized.observe(el);
      // Content above the band can move it with no scroll: the page's own
      // size changes with it.
      resized.observe(document.documentElement);
    }
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      resized?.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      path.setBand(null);
    };
  }, [path]);

  useEffect(() => {
    if (open) return;
    const frame = requestAnimationFrame(() => {
      opened.add(path);
      setOpen(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, path]);

  const whole = useSyncExternalStore(path.subscribe, path.whole, () => false);
  const moveBy = useCallback(
    (by: number) => {
      const to = stepStation(lessons, path.at(), by);
      if (to === null) return;
      path.setAt(to);
      link(to)?.focus({ preventScroll: true });
    },
    [lessons, link, path],
  );
  const gestures = useGestures(path, moveBy, link);

  // A scroll over the band pulls back or goes in; once it would change
  // nothing, it scrolls the page as ever.
  useEffect(() => {
    const el = band.current;
    if (el === null) return;
    const onWheel = (event: WheelEvent) => {
      const next = wheelWhole(event.deltaY, path.whole());
      if (next === path.whole()) return;
      event.preventDefault();
      path.setWhole(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [path]);

  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows] duration-(--duration-slow) ease-out",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          ref={band}
          data-journey-stage=""
          className="relative h-64 touch-pan-y select-none lg:h-80"
          {...gestures}
        >
          <div aria-hidden="true" className="absolute inset-0">
            <Stations path={path} lessons={lessons} />
            <FloatingPip path={path} />
          </div>
          <div className="absolute top-2 right-2">
            <Button
              size="sm"
              aria-pressed={whole}
              onClick={() => {
                path.setWhole(!path.whole());
              }}
            >
              {WHOLE_LEVEL}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The band's box on the page now, for placing what the Scene drew in it. */
function origin(path: JourneyPath): { left: number; top: number } {
  const b = path.band();
  return { left: b?.left ?? 0, top: b?.top ?? 0 };
}

/** Follows what the Scene drew, writing each part's place straight to the page: no render per frame. */
function useView(path: JourneyPath, draw: (view: PathView) => void): void {
  useLayoutEffect(() => {
    const redraw = () => {
      draw(path.view());
    };
    redraw();
    const offView = path.subscribeView(redraw);
    const offPath = path.subscribe(redraw);
    return () => {
      offView();
      offPath();
    };
  }, [path, draw]);
}

/** Each Station's mark: where a tap opens it, lit as the Scene drew it. */
function Stations({
  path,
  lessons,
}: {
  path: JourneyPath;
  lessons: readonly LessonId[];
}): ReactNode {
  const marks = useRef(new Map<LessonId, HTMLSpanElement>());
  const draw = useCallback(
    (view: PathView) => {
      const o = origin(path);
      const at = path.at();
      for (const lesson of lessons) {
        const el = marks.current.get(lesson);
        if (!el) continue;
        const p = view.points.find((q) => q.lesson === lesson);
        if (p === undefined) {
          el.hidden = true;
          continue;
        }
        el.hidden = false;
        el.style.left = `${String(p.x - o.left - p.r)}px`;
        el.style.top = `${String(p.y - o.top - p.r)}px`;
        el.style.width = el.style.height = `${String(2 * p.r)}px`;
        el.toggleAttribute("data-lit", p.lit);
        el.toggleAttribute("data-at", lesson === at);
      }
    },
    [path, lessons],
  );
  useView(path, draw);
  return lessons.map((lesson) => (
    <span
      key={lesson}
      ref={(el) => {
        if (el) marks.current.set(lesson, el);
        else marks.current.delete(lesson);
      }}
      data-station={lesson}
      hidden
      className="absolute cursor-pointer rounded-full"
    />
  ));
}

/** Pip, the guide's own 2D Pip, standing where the Scene draws his feet (09 9.4). */
function FloatingPip({ path }: { path: JourneyPath }): ReactNode {
  const model = usePipModel();
  usePipFollowsPointer();
  const box = useRef<HTMLDivElement>(null);
  const draw = useCallback(
    (view: PathView) => {
      const el = box.current;
      if (el === null) return;
      if (view.pip === null) {
        el.hidden = true;
        return;
      }
      const o = origin(path);
      el.hidden = false;
      el.style.transform = `translate(${String(view.pip.x - o.left)}px, ${String(view.pip.y - o.top)}px) translate(-50%, -100%)`;
    },
    [path],
  );
  useView(path, draw);
  return (
    <div
      ref={box}
      data-scene-pip=""
      hidden
      className="pointer-events-none absolute top-0 left-0"
    >
      <PipRenderer
        model={{ ...model, size: "beside" }}
        className={BOX.beside}
      />
    </div>
  );
}

/** The band's pointer and touch gestures: a tap on a Station, a swipe or a drag, and a pinch. */
function useGestures(
  path: JourneyPath,
  moveBy: (by: number) => void,
  link: (lesson: LessonId) => HTMLAnchorElement | null,
) {
  const down = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const moved = useRef(false);
  const spread = () => {
    const [a, b] = [...down.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if ((event.target as Element).closest("button")) return;
      down.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (down.current.size === 1) moved.current = false;
      if (down.current.size === 2) pinch.current = spread();
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!down.current.has(event.pointerId)) return;
      if (pinch.current !== null && down.current.size === 2) {
        down.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        const now = spread();
        const next = pinchWhole(pinch.current, now, path.whole());
        if (next !== path.whole()) {
          path.setWhole(next);
          pinch.current = now;
        }
        moved.current = true;
      }
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const start = down.current.get(event.pointerId);
      down.current.delete(event.pointerId);
      if (start === undefined) return;
      if (pinch.current !== null) {
        if (down.current.size === 0) pinch.current = null;
        return;
      }
      if (moved.current) return;
      const by = swipeStep(event.clientX - start.x, event.clientY - start.y);
      if (by !== 0) {
        moveBy(by);
        return;
      }
      // The mark under the finger, or else the Station drawn nearest it.
      const mark = (event.target as Element).closest("[data-station]");
      const lesson =
        mark?.getAttribute("data-station") ??
        stationAt(path.view().points, event.clientX, event.clientY)?.lesson;
      if (lesson !== undefined) link(lesson)?.click();
    },
    onPointerCancel: (event: PointerEvent<HTMLDivElement>) => {
      down.current.delete(event.pointerId);
      if (down.current.size < 2) pinch.current = null;
    },
  };
}
