// Seam S11, screen transitions (09 9.1): with the mount's switch on, each
// route change animates the leaving screen out and the new one in; without
// it the Local app keeps today's rise and the old screen is gone at once.
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { overview, snapshotOf } from "../../e2e/snapshots";
import { injectTokens, setMotionSwitch } from "../../test/motion";
import { renderMounted } from "../../test/mounted";
import type { ScreenChange, ScreenTransitions } from "../mount/types";
import css from "../styles/tokens.css?raw";
import { block, declarations, reducedMotion } from "../tokens/tokens";

const atJourney = snapshotOf(overview);
/** --duration-slow as tokens.css sets it, and under reduced motion. */
const CAP_MS = 360;
const REDUCED_CAP_MS = 120;

function mounted(transitions?: ScreenTransitions) {
  injectTokens();
  return renderMounted("/journey/", atJourney, {
    ...(transitions ? { transitions } : {}),
  });
}

async function go(name: "Journey" | "Progress"): Promise<void> {
  const main = screen.getByRole("navigation", { name: "Main" });
  await userEvent.click(within(main).getByRole("link", { name }));
}

const live = () => document.querySelector<HTMLElement>("[data-screen]");
const copies = () => [
  ...document.querySelectorAll<HTMLElement>("[data-screen-leaving]"),
];

describe("screen transitions, off (the default)", () => {
  test("the new screen rises in and the old one is gone at once: no copy, no layer", async () => {
    mounted();
    await go("Progress");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(live()?.className).toBe("animate-rise");
    expect(copies()).toEqual([]);
    expect(document.querySelector("[data-screen-leaving-layer]")).toBeNull();
  });
});

describe("screen transitions, on", () => {
  test("the leaving screen's copy animates out over the page while the new screen enters", async () => {
    mounted({});
    const before = live()?.textContent ?? "";
    await go("Progress");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(live()?.className).toBe("animate-screen-in");
    const [copy] = copies();
    expect(copy).toBeDefined();
    expect(copy?.className).toContain("animate-screen-out");
    expect(copy?.textContent).toBe(before);
    expect(copy?.parentElement).toHaveAttribute("data-screen-leaving-layer");
    // Fixed over the viewport, under the top bar, never a target.
    expect(copy?.parentElement?.className).toContain("fixed");
    expect(copy?.parentElement?.className).toContain("pointer-events-none");
    expect(copy?.style.position).toBe("absolute");
    // Its exit ends: it goes.
    fireEvent.animationEnd(copy as HTMLElement);
    expect(copies()).toEqual([]);
  });

  test("the leaving copy is inert and hidden from assistive technology, and nothing on it can be found twice", async () => {
    mounted({});
    await go("Progress");
    const [copy] = copies();
    expect(copy?.inert).toBe(true);
    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(copy).not.toHaveAttribute("data-screen");
    // One heading, the new screen's, in the accessibility tree.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      copy?.querySelector("[id], [name], [data-page-title], [data-pip]"),
    ).toBeNull();
    expect(document.querySelectorAll("[data-page-title]")).toHaveLength(1);
  });

  test("focus moves to the new screen's heading at once, while the copy still shows", async () => {
    mounted({});
    await go("Progress");
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Progress",
    });
    expect(heading).toHaveFocus();
    expect(live()).toContainElement(heading);
    expect(copies()).toHaveLength(1);
  });

  test("a copy whose exit never ends (a hidden page) goes at the cap", async () => {
    mounted({});
    await go("Progress");
    expect(copies()).toHaveLength(1);
    await waitFor(
      () => {
        expect(copies()).toEqual([]);
      },
      { timeout: CAP_MS * 3 },
    );
  });

  test("a route change mid-transition copies the entering screen where it stands, and nothing waits", async () => {
    mounted({});
    await go("Progress");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    // Progress mid-enter: part faded in, part risen.
    const entering = live() as HTMLElement;
    entering.style.opacity = "0.4";
    entering.style.transform = "translateY(3px)";
    await go("Journey");
    expect(live()).not.toBe(entering);
    expect(live()?.className).toBe("animate-screen-in");
    const [first, second] = copies();
    expect(copies()).toHaveLength(2);
    // Its exit starts from where Progress stood.
    expect(second?.style.getPropertyValue("--screen-from-opacity")).toBe("0.4");
    expect(second?.style.getPropertyValue("--screen-from-transform")).toBe(
      "translateY(3px)",
    );
    expect(second).toHaveTextContent("Progress");
    // The first copy keeps fading on its own; neither holds the new screen back.
    expect(first?.style.getPropertyValue("--screen-from-opacity")).not.toBe(
      "0.4",
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: /journey/i }),
    ).toHaveFocus();
  });

  test("the mount's move is told each change before its first frame, with the cap, and is aborted at the cap", async () => {
    const changes: ScreenChange[] = [];
    mounted({
      move: (change) => {
        changes.push(change);
        return "under";
      },
    });
    await go("Progress");
    expect(changes).toHaveLength(1);
    const [change] = changes;
    expect(change?.from).toEqual({ path: "/journey", screen: "map" });
    expect(change?.to).toEqual({ path: "/progress", screen: "progress" });
    expect(change?.cap).toBe(CAP_MS);
    expect(change?.reduced).toBe(false);
    expect(change?.signal.aborted).toBe(false);
    // Under the move, the screens still exit and enter.
    expect(copies()).toHaveLength(1);
    expect(live()?.className).toBe("animate-screen-in");
    await waitFor(
      () => {
        expect(change?.signal.aborted).toBe(true);
      },
      { timeout: CAP_MS * 3 },
    );
  });

  test("a new route change aborts the move in flight where it stands", async () => {
    const changes: ScreenChange[] = [];
    mounted({
      move: (change) => {
        changes.push(change);
        return "under";
      },
    });
    await go("Progress");
    await go("Journey");
    expect(changes.map((c) => c.to.path)).toEqual(["/progress", "/journey"]);
    expect(changes[0]?.signal.aborted).toBe(true);
    expect(changes[1]?.signal.aborted).toBe(false);
  });

  test("a move played instead of the exit and enter leaves no copy and no enter", async () => {
    const move = vi.fn(() => "instead" as const);
    mounted({ move });
    await go("Progress");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(move).toHaveBeenCalledTimes(1);
    expect(copies()).toEqual([]);
    expect(live()?.className).toBe("");
  });

  test("under reduced motion the move is told so, and the cap is 120 ms", async () => {
    const changes: ScreenChange[] = [];
    mounted({
      move: (change) => {
        changes.push(change);
        return "under";
      },
    });
    await setMotionSwitch("reduce");
    await go("Progress");
    expect(changes[0]?.reduced).toBe(true);
    expect(changes[0]?.cap).toBe(REDUCED_CAP_MS);
  });

  test("the unmount ends the move and removes every copy", async () => {
    const changes: ScreenChange[] = [];
    const { unmount } = mounted({
      move: (change) => {
        changes.push(change);
        return "under";
      },
    });
    await go("Progress");
    expect(copies()).toHaveLength(1);
    act(() => {
      unmount();
    });
    expect(copies()).toEqual([]);
    expect(changes[0]?.signal.aborted).toBe(true);
  });
});

describe("the transition tokens", () => {
  const theme = block(css, "@theme static {");
  const full = declarations(theme);
  const reduced = reducedMotion(css);

  test("the enter and the exit run on the scale's durations, within the cap (--duration-slow)", () => {
    expect(full.get("--animate-screen-in")).toBe(
      "rise var(--duration-base) var(--ease-out) both",
    );
    expect(full.get("--animate-screen-out")).toBe(
      "screen-out var(--duration-fast) var(--ease-out) both",
    );
  });

  test("under reduced motion a screen change is a cross-fade: opacity alone", () => {
    expect(reduced.get("--animate-screen-in")).toBe(
      "fade var(--duration-base) var(--ease-out) both",
    );
    expect(reduced.get("--animate-screen-out")).toBe(
      "screen-fade-out var(--duration-fast) var(--ease-out) both",
    );
    const fade = block(theme, "@keyframes fade {");
    const fadeOut = block(css, "\n@keyframes screen-fade-out {");
    for (const frames of [fade, fadeOut]) {
      expect(frames).toContain("opacity");
      expect(frames).not.toContain("transform");
    }
  });
});
