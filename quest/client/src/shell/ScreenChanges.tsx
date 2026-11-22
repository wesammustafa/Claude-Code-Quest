import { Component, createRef, type ReactNode, type RefObject } from "react";
import type { ScreenOnShow, ScreenTransitions } from "../mount/types";
import { copyLeaving, showLeaving, type LeavingCopy } from "./leaving";

/** The entering screen's class: today's rise, or the transition's own enter. */
export function enterClass(transitions: ScreenTransitions | null): string {
  return transitions === null ? "animate-rise" : "animate-screen-in";
}

interface Props {
  /** The screen on show; a new path is a route change. */
  screen: ScreenOnShow;
  /** The keyed screen element, the one the page reads and focuses. */
  live: RefObject<HTMLDivElement | null>;
  /** Null: no transitions, as the Local app has none. */
  transitions: ScreenTransitions | null;
  /** The Motion standard's cap now, in milliseconds. */
  cap: number;
  reduced: boolean;
  children: ReactNode;
}

/** What a route change carries past its commit: the leaving copy, or null when the mount's move plays instead. */
interface Change {
  copy: LeavingCopy | null;
}

/**
 * Seam S11: on each route change, the leaving screen animates out and the
 * new one in (09 9.1). The new screen is the page's own from its first
 * frame, so it takes focus and input at once; the leaving one is a still
 * copy (leaving.ts), `inert` and hidden from assistive technology, laid
 * over the page until its exit ends. A route change during a transition
 * copies the entering screen where it stands, so the next exit goes on from
 * there and nothing waits; an earlier copy keeps fading on its own. The
 * mount's move is told each change before its first frame and aborted at
 * the cap, by the next change or on unmount. A class, since only
 * getSnapshotBeforeUpdate reads the leaving screen before React removes it.
 */
export class ScreenChanges extends Component<Props> {
  private readonly layer = createRef<HTMLDivElement>();
  private readonly removals = new Set<() => void>();
  private move: AbortController | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | undefined;

  override getSnapshotBeforeUpdate(prev: Props): Change | null {
    const { transitions, screen, live } = this.props;
    const el = live.current;
    if (transitions === null || el === null || prev.screen.path === screen.path)
      return null;
    const instead = this.startMove(transitions, prev.screen) === "instead";
    return { copy: instead ? null : copyLeaving(el) };
  }

  override componentDidUpdate(
    _prev: Props,
    _state: unknown,
    change: Change | null,
  ): void {
    if (change === null) return;
    const { copy } = change;
    if (copy === null) {
      // The mount's move plays in place of the exit and enter.
      this.props.live.current?.classList.remove(
        enterClass(this.props.transitions),
      );
      return;
    }
    const layer = this.layer.current;
    if (layer === null) return;
    const remove = showLeaving(layer, copy, this.props.cap, () => {
      this.removals.delete(remove);
    });
    this.removals.add(remove);
  }

  override componentWillUnmount(): void {
    this.endMove();
    for (const remove of [...this.removals]) remove();
  }

  /** Ends the mount's move in flight where it stands, then tells it the new change. */
  private startMove(
    transitions: ScreenTransitions,
    from: ScreenOnShow,
  ): "under" | "instead" {
    this.endMove();
    const { move } = transitions;
    if (move === undefined) return "under";
    const abort = new AbortController();
    this.move = abort;
    const { cap, reduced, screen } = this.props;
    this.moveTimer = setTimeout(() => {
      abort.abort();
    }, cap);
    return move({ from, to: screen, cap, reduced, signal: abort.signal });
  }

  private endMove(): void {
    clearTimeout(this.moveTimer);
    this.move?.abort();
    this.move = null;
  }

  override render(): ReactNode {
    return (
      <>
        {this.props.children}
        {this.props.transitions !== null && (
          // The leaving copies' layer: fixed over the viewport, under the top bar.
          <div
            ref={this.layer}
            data-screen-leaving-layer=""
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
          />
        )}
      </>
    );
  }
}
