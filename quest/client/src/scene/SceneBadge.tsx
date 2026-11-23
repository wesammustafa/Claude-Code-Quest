import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { LessonBadge, type LessonBadgeProps } from "../components/badges";
import { cx } from "../lib/cx";
import { useMount } from "../mount/context";
import {
  tokenMs,
  useBadgeStage,
  useBadgesDrawn,
  type BadgeReveal,
  type BadgeSlot,
  type BadgeStage,
  type SlotHandle,
} from "./badges";

/** The Badge shelf's one line, shown while the Scene draws its Badges. */
export const SHELF_HINT = "Drag an earned badge to turn it.";

/** An arrow key's turn of a Badge on the shelf, and a dragged pixel's. */
const TURN_STEP = Math.PI / 8;
const DRAG_TURN = Math.PI / 180;
const DEGREES = 180 / Math.PI;
const FULL_TURN = 360;

export interface SceneBadgeProps extends LessonBadgeProps {
  /** On a revealed Badge: one light for each passed Check line. */
  lights?: number;
  /** On the Badge shelf: an earned Badge turns by drag and by the arrow keys while it has focus. */
  turns?: boolean;
}

/**
 * A Lesson's Badge where the Scene may draw it (09 9.3, ticket 53): Lesson
 * complete's Badge and the Badge shelf's. With the Scene off it is the SVG
 * Badge, exactly as before. With it on and drawing, the 3D Badge stands in
 * at the SVG's place and size: the SVG stays in the page with its name, see-
 * through, so the HTML is still the keyboard and screen reader path. A
 * reveal then plays in 3D, and any key or click skips it to the formed
 * Badge without being held back. Where the Scene cannot draw it (the still
 * tier, no renderer yet), a reveal shows the formed SVG Badge at once with
 * at most a 120 ms cross-fade, never the SVG's pop. A reveal happens once.
 */
export function SceneBadge({
  lights = 0,
  turns = false,
  ...badge
}: SceneBadgeProps): ReactNode {
  const { scene } = useMount();
  if (scene === null) return <LessonBadge {...badge} />;
  return <InScene lights={lights} turns={turns} badge={badge} />;
}

/** What a reveal became once it was asked for: drawn in 3D, or its end state cross-faded in. */
type Moment = "none" | "drawn" | "cross-fade";

/**
 * A reveal as it runs, once: told at its start, ended by its timer or by a
 * key or click, and kept across Strict Mode's second effect run.
 */
class RevealRun {
  readonly reveal: BadgeReveal;
  /** Drawn in 3D, rather than its end state cross-faded in. */
  readonly drawn: boolean;
  private readonly stage: BadgeStage;
  private readonly lesson: string;
  private readonly slot: () => SlotHandle | null;
  private readonly ended: () => void;
  private over = false;
  private gone: number | null = null;

  constructor({
    stage,
    lesson,
    drawn,
    lights,
    slot,
    ended,
  }: {
    stage: BadgeStage;
    lesson: string;
    drawn: boolean;
    lights: number;
    slot: () => SlotHandle | null;
    ended: () => void;
  }) {
    this.stage = stage;
    this.lesson = lesson;
    this.drawn = drawn;
    this.slot = slot;
    this.ended = ended;
    const ms = tokenMs(drawn ? "--duration-reveal" : "--duration-cross-fade");
    this.reveal = { startedAt: performance.now(), ms, lights, done: false };
    if (drawn) slot()?.update({ reveal: this.reveal });
    stage.tell({ type: "start", lesson, lights, ms, drawn });
  }

  /** Still playing: not ended or skipped. */
  get live(): boolean {
    return !this.over;
  }

  /**
   * Runs its timer and, drawn, hears the skip, until the returned stop. A
   * stop not followed at once by another play (the component gone, not
   * Strict Mode's second run) ends it as a skip.
   */
  play(): () => void {
    if (this.gone !== null) window.clearTimeout(this.gone);
    this.gone = null;
    if (this.over) return () => undefined;
    const left = Math.max(
      0,
      this.reveal.startedAt + this.reveal.ms - performance.now(),
    );
    const timer = window.setTimeout(() => {
      this.finish("end");
    }, left);
    // Heard first, on the way down, and never stopped or held: the key or
    // click goes on to do what it does.
    const skip = () => {
      this.finish("skip");
    };
    const listen = this.drawn;
    if (listen) {
      window.addEventListener("keydown", skip, {
        capture: true,
        passive: true,
      });
      window.addEventListener("pointerdown", skip, {
        capture: true,
        passive: true,
      });
    }
    return () => {
      window.clearTimeout(timer);
      if (listen) {
        window.removeEventListener("keydown", skip, { capture: true });
        window.removeEventListener("pointerdown", skip, { capture: true });
      }
      this.gone = window.setTimeout(() => {
        this.finish("skip");
      }, 0);
    };
  }

  private finish(type: "skip" | "end"): void {
    if (this.over) return;
    this.over = true;
    this.reveal.done = true;
    if (this.drawn) this.slot()?.update({ reveal: this.reveal });
    this.ended();
    this.stage.tell({ type, lesson: this.lesson });
  }
}

function InScene({
  lights,
  turns,
  badge: { reveal = false, ...badge },
}: {
  lights: number;
  turns: boolean;
  badge: LessonBadgeProps;
}): ReactNode {
  const stage = useBadgeStage();
  const drawn = useBadgesDrawn();
  const box = useRef<HTMLSpanElement>(null);
  const slot = useRef<SlotHandle | null>(null);
  const run = useRef<RevealRun | null>(null);
  const [moment, setMoment] = useState<Moment>("none");
  const [over, setOver] = useState(false);
  const [turn, setTurn] = useState(0);
  const turnNow = useRef(0);
  const drag = useRef<number | null>(null);
  const { lesson, earned, name } = badge;
  const size = badge.size ?? "lg";
  const stands = drawn && name !== null;

  // A reveal is decided once, the first time it is asked for.
  if (reveal && moment === "none") setMoment(drawn ? "drawn" : "cross-fade");

  // The 3D Badge stands in while the Scene draws.
  useEffect(() => {
    const element = box.current?.querySelector("svg");
    if (!stands || !element) return;
    const current = run.current;
    const added: BadgeSlot = {
      lesson,
      earned,
      size,
      element,
      turn: turnNow.current,
      reveal: current?.drawn === true && current.live ? current.reveal : null,
    };
    const handle = stage.add(added);
    slot.current = handle;
    return () => {
      handle.remove();
      if (slot.current === handle) slot.current = null;
    };
  }, [stands, stage, lesson, earned, size]);

  // The reveal itself, once: its start, then its end or a skip.
  useEffect(() => {
    if (moment === "none") return;
    run.current ??= new RevealRun({
      stage,
      lesson,
      drawn: moment === "drawn",
      lights,
      slot: () => slot.current,
      ended: () => {
        setOver(true);
      },
    });
    return run.current.play();
  }, [moment, stage, lesson, lights]);

  const turnTo = (next: number) => {
    turnNow.current = next;
    setTurn(next);
    slot.current?.update({ turn: next });
  };

  const turnable = turns && earned && stands;
  const degrees =
    ((Math.round(turn * DEGREES) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  const shelf = turnable
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": name,
        "aria-valuemin": 0,
        "aria-valuemax": FULL_TURN - 1,
        "aria-valuenow": degrees,
        "aria-valuetext": `${String(degrees)} degrees`,
        onKeyDown: (e: KeyboardEvent) => {
          const by =
            e.key === "ArrowRight" || e.key === "ArrowUp"
              ? TURN_STEP
              : e.key === "ArrowLeft" || e.key === "ArrowDown"
                ? -TURN_STEP
                : null;
          if (e.key === "Home") {
            e.preventDefault();
            turnTo(0);
          } else if (by !== null) {
            e.preventDefault();
            turnTo(turnNow.current + by);
          }
        },
        onPointerDown: (e: PointerEvent<HTMLSpanElement>) => {
          drag.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e: PointerEvent) => {
          if (drag.current === null) return;
          turnTo(turnNow.current + (e.clientX - drag.current) * DRAG_TURN);
          drag.current = e.clientX;
        },
        onPointerUp: () => {
          drag.current = null;
        },
        onPointerCancel: () => {
          drag.current = null;
        },
      }
    : {};

  return (
    <span
      ref={box}
      data-scene-badge=""
      {...(moment !== "none"
        ? {
            "data-badge-reveal":
              moment === "drawn" && !over ? "playing" : "formed",
            "data-badge-lights": lights,
          }
        : {})}
      {...shelf}
      className={cx(
        "inline-flex rounded-md",
        // See-through, not hidden: its name stays for screen readers.
        stands && "[&_svg]:opacity-0",
        turnable && "cursor-grab touch-pan-y",
        moment === "cross-fade" && "animate-cross-fade",
      )}
    >
      <LessonBadge
        {...badge}
        reveal={reveal || moment !== "none"}
        pop={false}
      />
    </span>
  );
}

/** The Badge shelf's line, while the Scene draws its Badges and one is earned. */
export function BadgeShelfHint({ earned }: { earned: boolean }): ReactNode {
  const { scene } = useMount();
  const drawn = useBadgesDrawn();
  if (scene === null || !drawn || !earned) return null;
  return <p className="text-sm text-muted">{SHELF_HINT}</p>;
}
