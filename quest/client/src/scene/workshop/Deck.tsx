// The workshop's parts that ride on the Scene (the warm workshop, D8),
// drawn into the place a screen keeps for them (the workshop's host) and
// shipped with the renderer, so a page that never draws the room never
// loads them: Pip's bubble over his head and the live line that says what
// he does, a tag over each Level's place, Pip's toolbar, Explore with its
// stick, and taps on the room itself. Every part is HTML on a surface over
// the canvas, which stays aria-hidden and inert; each 3D move has a button
// or a link. No key is caught but Explore's, and only while it is on; Tab
// never is.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { LessonId } from "@quest/contract";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { InlineText } from "../../components/InlineText";
import { LEVEL_NAMES } from "../../course/labels";
import { cx } from "../../lib/cx";
import { tokenSeconds } from "../../lib/motion";
import type { SceneStation } from "../../mount/types";
import { Link, useQuestNavigate } from "../../mount/links";
import { summaryOf, useCourseSnapshot } from "../../screens/lesson";
import { EYEBROW } from "../../screens/layout";
import { usePipInput } from "../../pip/PipStage";
import { usePipStandsDown } from "../context";
import { useJourneyPath } from "../path";
import {
  OTHER_SPOTS,
  SPOT_NAMES,
  activityLine,
  dropNextClick,
  keysSteer,
  roomTap,
  stickSteer,
  STEER_KEYS,
  tapsRoom,
  typesInto,
  type Steer,
} from "./controls";
import type { SpotId } from "./layout";
import { placeOfLesson, workshopPlaces, type WorkshopPlace } from "./places";
import {
  useWorkshop,
  type Anchor,
  type AnchorId,
  type DeckHost,
} from "./store";

const MS_PER_SECOND = 1000;
/** A pointer that moves further than this, in CSS pixels, between down and up drags rather than taps. */
const TAP_SLOP_PX = 10;
/** How far a tag keeps from the window's edges, in CSS pixels: the page's phone gutter. */
const EDGE_PX = 16;

/** SURFACE without its border colour and shadow, for a part that sets its own: cx only joins, so two of one property would clash. */
const PANEL = "rounded-lg border bg-surface";
/** A surface over the Scene: the page's card, so no word sits on the canvas. */
const SURFACE = `${PANEL} border-line shadow-md`;
/** Pip's controls: a 44 px target at the least. */
const TOOL = "min-h-11";

export interface WorkshopDeckProps {
  /** The screen's host: the whole room (Welcome), Pip's buttons alone in its flow (the Journey), or his bubble alone (a Lesson's overview). */
  kind: DeckHost["kind"];
  /** What Pip says while nothing else is said: the bubble-only host's line. */
  line?: string | null;
  /** The 3D Pip stands in the room, so his bubble, his buttons and Explore come too. */
  pip: boolean;
  stations: readonly SceneStation[];
}

/**
 * The workshop's parts, drawn into the screen's host while one is on show:
 * the renderer renders this beside its canvas, outside the Scene's inert
 * layer, so the parts are the page's own.
 */
export function DeckPortal({
  pip,
  stations,
}: Omit<WorkshopDeckProps, "kind">): ReactNode {
  const workshop = useWorkshop();
  const host = useSyncExternalStore(
    workshop.subscribeHost,
    workshop.host,
    () => null,
  );
  if (host === null) return null;
  return createPortal(
    <WorkshopDeck
      kind={host.kind}
      line={host.kind === "pip" ? host.line : null}
      pip={pip}
      stations={stations}
    />,
    host.element,
  );
}

/** One line in Pip's bubble, new each time it is said. */
interface Said {
  words: ReactNode;
  key: number;
}

/** The workshop's parts on the page, once the renderer draws the room. */
export function WorkshopDeck({
  kind,
  line = null,
  pip,
  stations,
}: WorkshopDeckProps): ReactNode {
  const workshop = useWorkshop();
  const ready = useSyncExternalStore(
    workshop.subscribeReady,
    workshop.ready,
    () => false,
  );
  const snapshot = useCourseSnapshot();
  const navigate = useQuestNavigate();
  const path = useJourneyPath();
  const places = useMemo(() => workshopPlaces(stations), [stations]);
  const [said, setSaid] = useState<Said | null>(null);
  const spoken = useRef(0);
  const say = useCallback((words: ReactNode) => {
    spoken.current += 1;
    setSaid({ words, key: spoken.current });
  }, []);
  const [exploring, setExploring] = useState(false);
  /** Explore left by Done or Esc: focus goes back to Explore with Pip. */
  const [leftExplore, setLeftExplore] = useState(false);

  // The 3D Pip greets in the room; until he holds Pip, or where his model
  // failed, the screen's own Pip does.
  const standsDown = usePipStandsDown();
  const sendPip = usePipInput();
  const hello = useCallback(() => {
    if (standsDown) workshop.send({ type: "greet" });
    else sendPip({ type: "greet" });
  }, [workshop, standsDown, sendPip]);
  // Every greet in the room says hello in his bubble: a tap on him, the toolbar's.
  useEffect(
    () =>
      workshop.onCommand((command) => {
        if (command.type === "greet") say("Hello!");
      }),
    [workshop, say],
  );
  const sendTo = useCallback(
    (spot: SpotId) => {
      workshop.send({ type: "goTo", to: { spot } });
    },
    [workshop],
  );
  // The course's next Lesson, as the snapshot names it: Pip walks to its
  // place and says its title.
  const next = snapshot?.course.next ?? null;
  const nextTitle =
    next === null ? null : (summaryOf(snapshot, next)?.title ?? null);
  const whatsNext = useCallback(() => {
    if (next === null || nextTitle === null) {
      say("Every lesson is complete");
      return;
    }
    const place = placeOfLesson(stations, next);
    if (place !== null) sendTo(place);
    say(
      <>
        {"Next: "}
        <InlineText text={nextTitle} />
      </>,
    );
  }, [next, nextTitle, stations, sendTo, say]);
  const explore = useCallback((on: boolean) => {
    setExploring(on);
    if (on) setLeftExplore(false);
  }, []);
  // Explore holds Pip while it is on; its end, or leaving the screen, sends
  // him back to the screen's goal.
  useEffect(() => {
    if (!exploring) return;
    workshop.send({ type: "explore", on: true });
    return () => {
      workshop.send({ type: "explore", on: false });
    };
  }, [exploring, workshop]);

  const onTap = useCallback(
    (x: number, y: number) => {
      const tap = roomTap(workshop.pick(x, y), path.view().points, x, y);
      if (tap === null) return;
      if (tap.type === "open") {
        dropNextClick();
        void navigate(`/lesson/${tap.lesson}`);
        return;
      }
      if (!pip) return;
      if (tap.type === "greet") hello();
      else if (tap.to.kind === "place") sendTo(tap.to.place);
      // The floor is the room's: on the Journey it shows only round the page's cards.
      else if (kind === "room" && !exploring)
        workshop.send({
          type: "goTo",
          to: { floor: { x: tap.to.x, z: tap.to.z } },
        });
    },
    [workshop, path, navigate, pip, hello, sendTo, kind, exploring],
  );
  // Pip's bubble alone takes no taps: the screen it rides on keeps them.
  useRoomTaps(onTap, ready && kind !== "pip");

  if (!ready) return null;
  return (
    <>
      {pip && <PipBubble said={said} line={line} onCleared={setSaid} />}
      {pip && <LiveLine />}
      {kind === "room" && snapshot !== null && (
        <PlaceTags places={places} next={next} quiet={exploring} />
      )}
      {pip &&
        kind !== "pip" &&
        (exploring ? (
          <ExploreBar
            onDone={() => {
              setLeftExplore(true);
              explore(false);
            }}
          />
        ) : (
          <PipToolbar
            kind={kind}
            focusExplore={leftExplore}
            places={places}
            onHello={hello}
            onSend={sendTo}
            onNext={whatsNext}
            onExplore={
              kind === "room"
                ? () => {
                    explore(true);
                  }
                : null
            }
          />
        ))}
    </>
  );
}

/**
 * Taps on the room: a pointer pressed and let go in place on the page's
 * frame or a screen's spacer, never on a control or a surface, so the
 * page's own controls keep every tap. No key is heard here.
 */
function useRoomTaps(onTap: (x: number, y: number) => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    let down: { id: number; x: number; y: number } | null = null;
    const press = (event: PointerEvent) => {
      down =
        event.isPrimary && event.button === 0 && tapsRoom(event.target)
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null;
    };
    const release = (event: PointerEvent) => {
      const from = down;
      down = null;
      if (
        from === null ||
        event.pointerId !== from.id ||
        !tapsRoom(event.target) ||
        Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_SLOP_PX
      )
        return;
      onTap(event.clientX, event.clientY);
    };
    const cancel = () => {
      down = null;
    };
    document.addEventListener("pointerdown", press);
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", cancel);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", cancel);
    };
  }, [onTap, on]);
}

/**
 * Places an element at an anchor as the renderer draws it, frame by frame,
 * with no React render: its `transform`, and `data-anchored` (shown or
 * hidden) for its styles. `fit` may move the point, to keep it on screen.
 * With `offPage`, an anchor ahead of the camera but off the page shows
 * too, where `fit` brings it onto the page.
 */
function useAnchored<T extends HTMLElement>(
  id: AnchorId,
  fit: (anchor: Anchor, el: T) => { x: number; y: number } = (a) => a,
  offPage = false,
) {
  const workshop = useWorkshop();
  const ref = useRef<T>(null);
  const fitNow = useRef(fit);
  useLayoutEffect(() => {
    fitNow.current = fit;
  });
  useLayoutEffect(() => {
    const draw = () => {
      const el = ref.current;
      if (el === null) return;
      const anchor = workshop.anchors()[id];
      if (
        anchor === undefined ||
        !(anchor.visible || (offPage && anchor.ahead))
      ) {
        el.dataset.anchored = "hidden";
        return;
      }
      const { x, y } = fitNow.current(anchor, el);
      el.dataset.anchored = "shown";
      el.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
    };
    draw();
    const off = workshop.subscribeAnchors(draw);
    window.addEventListener("resize", draw);
    // What the element keeps clear of may change size with no anchor moving.
    const clear = ref.current === null ? [] : clearOf(ref.current);
    const resized =
      clear.length > 0 && typeof ResizeObserver === "function"
        ? new ResizeObserver(draw)
        : null;
    for (const el of clear) resized?.observe(el);
    return () => {
      off();
      window.removeEventListener("resize", draw);
      resized?.disconnect();
    };
  }, [workshop, id, offPage]);
  return ref;
}

/** The screen's parts a tag keeps clear of, such as Welcome's card: each marked `data-deck-clear` in the tag's screen. */
function clearOf(el: HTMLElement): HTMLElement[] {
  return [
    ...(el
      .closest("main")
      ?.querySelectorAll<HTMLElement>("[data-deck-clear]") ?? []),
  ];
}

const clamp = (v: number, lo: number, hi: number) =>
  hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

/** The point an element hung above its anchor and centred on it keeps, so all of it stays EDGE_PX inside the window. */
function onScreen(anchor: Anchor, el: HTMLElement): { x: number; y: number } {
  const card = el.firstElementChild as HTMLElement | null;
  const half = (card?.offsetWidth ?? 0) / 2;
  const tall = card?.offsetHeight ?? 0;
  return {
    x: clamp(anchor.x, EDGE_PX + half, window.innerWidth - EDGE_PX - half),
    y: clamp(anchor.y, EDGE_PX + tall, window.innerHeight - EDGE_PX),
  };
}

/**
 * onScreen's point, moved off any part of the screen the tag keeps clear
 * of (clearOf), to its side nearer the anchor: below Welcome's card at a
 * phone's top, above it at a desktop's foot.
 */
function clearOnScreen(
  anchor: Anchor,
  el: HTMLElement,
): { x: number; y: number } {
  const at = onScreen(anchor, el);
  const card = el.firstElementChild as HTMLElement | null;
  const half = (card?.offsetWidth ?? 0) / 2;
  const tall = card?.offsetHeight ?? 0;
  const gap = EDGE_PX / 2;
  for (const part of clearOf(el)) {
    const r = part.getBoundingClientRect();
    const overlaps =
      at.x + half > r.left - gap &&
      at.x - half < r.right + gap &&
      at.y > r.top - gap &&
      at.y - tall < r.bottom + gap;
    if (!overlaps) continue;
    const below = r.bottom + gap + tall;
    const above = r.top - gap;
    const fitsBelow = below <= window.innerHeight - EDGE_PX;
    const fitsAbove = above - tall >= EDGE_PX;
    const goBelow =
      fitsBelow && (!fitsAbove || anchor.y >= (r.top + r.bottom) / 2);
    if (goBelow || fitsAbove) at.y = goBelow ? below : above;
  }
  return at;
}

/** An anchored part: at the window's top left, moved to its anchor; nothing of it takes a pointer but what asks to. */
const ANCHORED =
  "pointer-events-none fixed top-0 left-0 z-5 data-[anchored=hidden]:invisible";

/**
 * Pip's bubble over his head: what he says, for a --says-hold read, else
 * the screen's standing line, as a status every reader hears; and, asleep
 * with nothing to say, his sleeping mark. Off camera it fades but still
 * speaks. It stands over the page's cards, which the place tags stand
 * under.
 */
function PipBubble({
  said,
  line,
  onCleared,
}: {
  said: Said | null;
  line: string | null;
  onCleared: (said: null) => void;
}): ReactNode {
  const workshop = useWorkshop();
  const status = useSyncExternalStore(
    workshop.subscribeStatus,
    workshop.status,
  );
  // Kept on the page: a long line over a Pip near its edge would run off it.
  const ref = useAnchored<HTMLDivElement>("pip", onScreen);
  useEffect(() => {
    if (said === null) return;
    const timer = setTimeout(
      () => {
        onCleared(null);
      },
      tokenSeconds("--says-hold") * MS_PER_SECOND,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [said, onCleared]);
  return (
    <div
      ref={ref}
      data-anchored="hidden"
      data-pip-bubble=""
      className="pointer-events-none fixed top-0 left-0 z-15 data-[anchored=hidden]:opacity-0"
    >
      <div
        role="status"
        className="absolute bottom-0 left-0 -translate-x-1/2 pb-3"
      >
        {(said !== null || line !== null) && (
          <p
            key={said?.key ?? "line"}
            data-pip-says=""
            className={cx(
              SURFACE,
              "w-max max-w-60 animate-pop px-3.5 py-2 text-sm font-semibold text-text",
            )}
          >
            {said === null ? line : said.words}
          </p>
        )}
        {said === null && line === null && status.activity === "asleep" && (
          <span
            aria-hidden="true"
            data-pip-asleep=""
            className={cx(
              SURFACE,
              "block w-max px-2.5 py-1 text-sm font-semibold tracking-eyebrow whitespace-nowrap text-muted",
            )}
          >
            z z
          </span>
        )}
      </div>
    </div>
  );
}

/** One quiet line a screen reader hears as Pip's doings change, never each frame. */
function LiveLine(): ReactNode {
  const workshop = useWorkshop();
  const [line, setLine] = useState("");
  useEffect(() => {
    let before = workshop.status();
    return workshop.subscribeStatus(() => {
      const now = workshop.status();
      const words = activityLine(before, now);
      before = now;
      if (words !== null) setLine(words);
    });
  }, [workshop]);
  return (
    <p className="sr-only" aria-live="polite" data-pip-activity="">
      {line}
    </p>
  );
}

/** A tag over each Level's place: a link to its next Lesson, or, its Level complete, to its last core Lesson. */
function PlaceTags({
  places,
  next,
  quiet,
}: {
  places: readonly WorkshopPlace[];
  next: LessonId | null;
  quiet: boolean;
}): ReactNode {
  return places.map((place) => (
    <PlaceTag
      key={place.id}
      place={place}
      next={next !== null && place.cards.some((c) => c.lesson === next)}
      quiet={quiet}
    />
  ));
}

function PlaceTag({
  place,
  next,
  quiet,
}: {
  place: WorkshopPlace;
  /** It holds the course's next Lesson. */
  next: boolean;
  /** Explore is on: the tags step back. */
  quiet: boolean;
}): ReactNode {
  const snapshot = useCourseSnapshot();
  // A place off the page's side still gets its tag, at the page's edge, as
  // a phone's narrow room shows only the board.
  const ref = useAnchored<HTMLDivElement>(place.id, clearOnScreen, true);
  // Complete as the Level is: every core Lesson done, a lab left or not.
  const core = place.cards.filter((c) => !c.optional);
  const done = core.length > 0 && core.every((c) => c.complete);
  const lesson = done
    ? core.at(-1)?.lesson
    : (place.next ?? place.cards.at(-1)?.lesson);
  const title = summaryOf(snapshot, lesson)?.title;
  if (lesson === undefined || title === undefined) return null;
  const level = LEVEL_NAMES[place.level];
  return (
    <div ref={ref} data-anchored="hidden" className={ANCHORED}>
      <Link
        to={`/lesson/${lesson}`}
        data-place-tag={place.id}
        {...(next ? { "data-next": "" } : {})}
        {...(done ? { "data-done": "" } : {})}
        className={cx(
          PANEL,
          // Never wider than the window inside its gutters, so onScreen can keep all of it there with large text.
          "pointer-events-auto absolute bottom-0 left-0 grid min-h-11 w-max max-w-[min(14rem,calc(100vw_-_2rem))] -translate-x-1/2 content-center gap-0.5 px-3.5 py-2 text-left no-underline",
          "transition-[border-color,box-shadow] duration-(--duration-fast) ease-out hover:border-accent-mark",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          // Stepping back drops the tag's lift, never its words' contrast: it is still a link.
          quiet
            ? "border-line shadow-none"
            : next
              ? "border-accent-mark shadow-selected"
              : "border-line shadow-md",
        )}
      >
        <span
          className={cx(
            EYEBROW,
            "flex items-center gap-1",
            done && "text-accent-text",
          )}
        >
          {done && <Icon name="check" size="sm" />}
          {done ? `${level} · complete` : level}
        </span>
        {/* A phone keeps only the next Lesson's sentence. */}
        <span
          className={cx(
            "text-sm font-semibold text-text",
            !next && "max-md:hidden",
          )}
        >
          <InlineText text={title} />
        </span>
      </Link>
    </div>
  );
}

/** The hosts that hold Pip's toolbar: all but his bubble alone. */
type ToolbarHost = Exclude<DeckHost["kind"], "pip">;

/**
 * Where Pip's controls sit: along the room's foot (on a wide screen to the
 * right, clear of Welcome's card), or in the screen's flow. Each width sets
 * its own margins: the app's stylesheet comes after the client's, so a
 * plain utility it also uses would beat a breakpoint's.
 */
const DOCK: Record<ToolbarHost, string> = {
  room: "fixed inset-x-4 bottom-4 z-10 w-fit max-md:mx-auto md:max-lg:mx-0 lg:mr-0 lg:ml-auto",
  inline: "w-fit max-w-full",
};

/** Moves focus along a row of controls with the arrows, as a toolbar does; Tab leaves it as ever. */
function moveAlong(event: ReactKeyboardEvent<HTMLElement>): void {
  const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
  if (!keys.includes(event.key)) return;
  const tools = [
    ...event.currentTarget.querySelectorAll<HTMLElement>("[data-tool]"),
  ];
  const at = tools.indexOf(event.target as HTMLElement);
  if (at === -1) return;
  const last = tools.length - 1;
  const to =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : event.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : Math.max(0, at - 1);
  event.preventDefault();
  tools[to]?.focus();
}

/** Pip's toolbar: Say hello, Send Pip to, What's next and, in the room, Explore with Pip. */
function PipToolbar({
  kind,
  focusExplore,
  places,
  onHello,
  onSend,
  onNext,
  onExplore,
}: {
  kind: ToolbarHost;
  /** Drawn again as Explore closes, the toolbar focuses Explore with Pip. */
  focusExplore: boolean;
  places: readonly WorkshopPlace[];
  onHello: () => void;
  onSend: (spot: SpotId) => void;
  onNext: () => void;
  onExplore: (() => void) | null;
}): ReactNode {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusExplore)
      bar.current?.querySelector<HTMLElement>("[data-explore]")?.focus();
  }, [focusExplore]);
  return (
    <div
      ref={bar}
      role="toolbar"
      aria-label="Pip"
      data-pip-toolbar=""
      onKeyDown={moveAlong}
      className={cx(
        SURFACE,
        DOCK[kind],
        "flex flex-wrap items-center justify-center gap-2 p-2",
      )}
    >
      <Button data-tool="" className={TOOL} onClick={onHello}>
        Say hello
      </Button>
      <SendMenu places={places} onSend={onSend} />
      <Button data-tool="" className={TOOL} onClick={onNext}>
        What's next
      </Button>
      {onExplore !== null && (
        <Button
          data-tool=""
          data-explore=""
          className={TOOL}
          onClick={onExplore}
        >
          Explore with Pip
        </Button>
      )}
    </div>
  );
}

/** Send Pip to: a list of the room's spots, each Level's place first; Esc closes it and focus goes back to its button. */
function SendMenu({
  places,
  onSend,
}: {
  places: readonly WorkshopPlace[];
  onSend: (spot: SpotId) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const list = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus)
      wrap.current?.querySelector<HTMLElement>("[data-tool]")?.focus();
  }, []);
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>("[data-spot]")?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) close(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, close]);
  const spots: { spot: SpotId; level: string | null }[] = [
    ...places.map((p) => ({ spot: p.id, level: LEVEL_NAMES[p.level] })),
    ...OTHER_SPOTS.map((spot) => ({ spot, level: null })),
  ];
  return (
    <div ref={wrap} className="relative">
      <Button
        data-tool=""
        className={TOOL}
        aria-expanded={open}
        aria-controls={list}
        iconEnd="chevron"
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        Send Pip to
      </Button>
      {open && (
        <ul
          id={list}
          aria-label="Send Pip to"
          className={cx(
            SURFACE,
            "absolute bottom-full left-1/2 z-10 mb-2 grid w-max min-w-48 -translate-x-1/2 gap-0.5 p-1.5",
          )}
        >
          {spots.map(({ spot, level }) => (
            <li key={spot}>
              <button
                type="button"
                data-spot={spot}
                onClick={() => {
                  onSend(spot);
                  close(true);
                }}
                className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-md px-3 text-left text-control text-text hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span>{SPOT_NAMES[spot].label}</span>
                {level !== null && (
                  <span className="text-sm text-muted">{level}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Explore: Pip's steering keys, and on a touch screen the stick, move him
 * while it is on; Esc or Done leaves, and focus goes to Done as it opens
 * and back to Explore with Pip as it closes. The words name no key.
 */
function ExploreBar({ onDone }: { onDone: () => void }): ReactNode {
  const workshop = useWorkshop();
  const touch = useTouch();
  const bar = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>("[data-done]")?.focus();
  }, []);
  useExploreKeys(
    workshop.send,
    useCallback(() => {
      done.current();
    }, []),
  );
  return (
    <>
      <div
        ref={bar}
        role="region"
        aria-label="Explore"
        data-explore-bar=""
        className={cx(SURFACE, DOCK.room, "flex items-center gap-3 p-2 pl-4")}
      >
        <p className="text-sm text-text">Steer Pip, or press Done to stop.</p>
        <Button
          data-done=""
          variant="primary"
          className={TOOL}
          onClick={onDone}
        >
          Done
        </Button>
      </div>
      {touch && <Stick steer={workshop.send} />}
    </>
  );
}

/** A touch screen: a pointer that is a finger, where the stick steers Pip. */
const TOUCH = "(any-pointer: coarse)";

/** Whether the device has a touch pointer, following it as that changes. */
function useTouch(): boolean {
  return useSyncExternalStore(
    (changed) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const list = window.matchMedia(TOUCH);
      list.addEventListener("change", changed);
      return () => {
        list.removeEventListener("change", changed);
      };
    },
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(TOUCH).matches,
    () => false,
  );
}

type Send = ReturnType<typeof useWorkshop>["send"];

/** An open menu or dialog on the page, which an Esc closes before it leaves Explore. */
const OPEN_POPUP = '[aria-expanded="true"], dialog[open], [aria-modal="true"]';

/**
 * The steering keys while Explore is on: held together they steer Pip
 * across the floor, Shift runs, Esc leaves. A key typed into a field, or
 * with a modifier other than Shift, is left be, and Tab is never heard.
 */
function useExploreKeys(send: Send, leave: () => void): void {
  useEffect(() => {
    const held = new Set<string>();
    let last: Steer = { x: 0, z: 0, run: false };
    const steer = (run: boolean) => {
      const next = keysSteer(held, run);
      if (next.x === last.x && next.z === last.z && next.run === last.run)
        return;
      last = next;
      send({ type: "steer", ...next });
    };
    const ignored = (event: KeyboardEvent) =>
      typesInto(event.target) || event.altKey || event.metaKey || event.ctrlKey;
    /** Whether a menu or dialog was open as the Esc being heard began. */
    let popupOpen = false;
    const down = (event: KeyboardEvent) => {
      if (event.key === "Escape")
        popupOpen = document.querySelector(OPEN_POPUP) !== null;
      if (ignored(event) || event.key === "Escape") return;
      if (STEER_KEYS[event.code] !== undefined) {
        event.preventDefault();
        held.add(event.code);
      }
      steer(event.shiftKey);
    };
    const up = (event: KeyboardEvent) => {
      held.delete(event.code);
      steer(event.shiftKey);
    };
    const lost = () => {
      held.clear();
      steer(false);
    };
    // Esc is heard last: a menu or dialog open as it began closes on it,
    // and only an Esc nothing else took leaves Explore.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || ignored(event))
        return;
      if (popupOpen) return;
      event.preventDefault();
      leave();
    };
    // Heard first, so an arrow steering Pip moves nothing else on the page.
    window.addEventListener("keydown", down, true);
    window.addEventListener("keydown", escape);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", lost);
    return () => {
      window.removeEventListener("keydown", down, true);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("keyup", up, true);
      window.removeEventListener("blur", lost);
      if (last.x !== 0 || last.z !== 0)
        send({ type: "steer", x: 0, z: 0, run: false });
    };
  }, [send, leave]);
}

/** The stick: drag inside its ring to walk Pip that way, past the ring to run. */
function Stick({ steer }: { steer: Send }): ReactNode {
  const ring = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const held = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = ring.current?.getBoundingClientRect();
    if (box === undefined) return;
    const reach = box.width / 2;
    const dx = event.clientX - (box.left + reach);
    const dy = event.clientY - (box.top + box.height / 2);
    const s = stickSteer(dx, dy, reach);
    const k = Math.min(1, reach / (Math.hypot(dx, dy) || 1));
    if (knob.current)
      knob.current.style.transform = `translate(${String(dx * k)}px, ${String(dy * k)}px)`;
    setRunning(s.run);
    steer({ type: "steer", ...s });
  };
  const end = () => {
    held.current = null;
    if (knob.current) knob.current.style.transform = "";
    setRunning(false);
    steer({ type: "steer", x: 0, z: 0, run: false });
  };
  return (
    <div
      ref={ring}
      role="application"
      aria-label="Steer Pip: drag to walk, drag past the ring to run"
      data-stick=""
      className={cx(
        "fixed bottom-24 left-4 z-10 grid size-28 lg:right-4 lg:left-auto touch-none place-items-center rounded-full border-2 bg-surface shadow-md select-none",
        running ? "border-accent-mark" : "border-line-2",
      )}
      onPointerDown={(event) => {
        held.current = event.pointerId;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // A pointer already let go cannot be captured; its moves still come here.
        }
        move(event);
      }}
      onPointerMove={(event) => {
        if (held.current === event.pointerId) move(event);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span
        ref={knob}
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink shadow-sm"
      >
        {running ? "Run" : "Walk"}
      </span>
    </div>
  );
}
