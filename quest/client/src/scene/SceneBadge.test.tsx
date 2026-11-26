// The 3D Badges' screens (09 9.3, ticket 53): Lesson complete's Badge reveal
// and the Progress screen's Badge shelf, with the Scene's renderer a
// stand-in that draws the stage's Badges (jsdom has no WebGL; the real one
// is e2e's). The reveal plays only on a won first completion, once, with
// one light per passed Check line, and any key or click skips it without
// being held; "New badge" is announced once; a reload or a second tab
// reveals nothing; the still tier shows the formed SVG Badge with a short
// cross-fade and loads no renderer. On the shelf an earned Badge turns by
// the arrow keys alone, an unearned one is an outline, and the HTML list
// keeps its headings and names. With the Scene off, nothing changes.
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  complete,
  completed,
  fullCourse,
  overview,
  snapshotOf,
} from "../../e2e/snapshots";
import { renderMounted } from "../../test/mounted";
import { stubReducedMotion } from "../../test/motion";
import type { SceneMount } from "../mount/types";
import {
  useBadgeReveal,
  useBadgeStage,
  type BadgeRevealEvent,
  type BadgeStage,
} from "./badges";
import { SHELF_HINT } from "./SceneBadge";
import { resetTierProbes } from "./tier";

/** What the stand-in renderer saw: the page's stage, and the reveal's events in order. */
interface Seen {
  stage: BadgeStage | null;
  events: BadgeRevealEvent[];
  /** The page's path as each event was told. */
  at?: string[];
}

const LOOK = {
  light: {
    sky: "#fbf6ef",
    ground: "#f0e5d5",
    light: "#fff6ee",
    ambient: 2.9,
    key: 1,
    shadow: "#3a1a10",
    workshop: {
      ambient: 2,
      key: 1.5,
      lamp: 0.4,
      floor: "#d8b48a",
      wall: "#f3e5d0",
      wood: "#b07a46",
      fabric: "#c86b5a",
      teal: "#2f6f68",
      leaf: "#8fb87a",
      window: "#fff1cf",
      glow: "#fff2c8",
      paper: "#fffdf8",
      ink: "#3b4256",
      done: "#e3f3e6",
      optional: "#e6f0fb",
      next: "#ff784e",
    },
  },
  dark: {
    sky: "#0b1020",
    ground: "#1f2a4d",
    light: "#ffd9c9",
    ambient: 2.6,
    key: 2.4,
    shadow: "#3a1a10",
    workshop: {
      ambient: 1.1,
      key: 0.6,
      lamp: 3,
      floor: "#6b4f3a",
      wall: "#4a4152",
      wood: "#7a5236",
      fabric: "#8f4a3f",
      teal: "#2f5f5c",
      leaf: "#4f6e48",
      window: "#1b2547",
      glow: "#ffd9a0",
      paper: "#f3ead9",
      ink: "#2b2f45",
      done: "#cfe9d4",
      optional: "#d6e3f5",
      next: "#ff8a5c",
    },
  },
};

/** A renderer that draws the stage's Badges, as SceneBadges does, and follows the reveal. */
function sceneSeeing(
  seen: Seen,
): SceneMount & { load: ReturnType<typeof vi.fn> } {
  function Draws(): ReactNode {
    const stage = useBadgeStage();
    useEffect(() => {
      seen.stage = stage;
      return stage.attach();
    }, [stage]);
    useBadgeReveal((event) => {
      seen.events.push(event);
      seen.at?.push(window.location.pathname);
    });
    return <div data-test-scene="" />;
  }
  return {
    load: vi.fn(() => Promise.resolve({ default: Draws })),
    look: LOOK,
  };
}

function giveWebgl2(): void {
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    // A constructor the page can name; the probe never calls it.
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: () => undefined }),
  } as unknown as RenderingContext);
}

const root = document.documentElement;

beforeEach(() => {
  resetTierProbes();
  giveWebgl2();
  root.style.setProperty("--duration-reveal", "200ms");
  root.style.setProperty("--duration-cross-fade", "120ms");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  root.removeAttribute("style");
  localStorage.clear();
  Reflect.deleteProperty(navigator, "connection");
});

function go(path: string): void {
  act(() => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const badge = () => document.querySelector<HTMLElement>("[data-scene-badge]");
const status = () =>
  document.querySelector<HTMLElement>('[role="status"].sr-only');

/** Counts each time the status line's words change from now. */
function announcements(): () => string[] {
  const said: string[] = [];
  const watch = new MutationObserver(() => {
    const words = status()?.textContent ?? "";
    if (words !== "" && said.at(-1) !== words) said.push(words);
  });
  watch.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  return () => {
    watch.disconnect();
    return said;
  };
}

/** Lesson complete, opened from the Journey once the renderer draws, as a Learner reaches it. */
async function atComplete(
  seen: Seen,
  lesson = complete,
  milestones = completed,
): Promise<() => string[]> {
  const scene = sceneSeeing(seen);
  renderMounted("/journey/", snapshotOf(lesson, { milestones }), { scene });
  await waitFor(() => {
    expect(seen.stage?.drawing()).toBe(true);
  });
  const said = announcements();
  go("/lesson/b-1/complete/");
  await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
  return said;
}

describe("with the Scene off (the default)", () => {
  test("Lesson complete's Badge is the SVG Badge as before, and the reveal is the SVG's", async () => {
    renderMounted(
      "/lesson/b-1/complete/",
      snapshotOf(complete, { milestones: completed }),
    );
    expect(await screen.findByText("New badge: Explorer")).toBeInTheDocument();
    expect(badge()).toBeNull();
    expect(screen.getByRole("img", { name: "Explorer" })).toBeVisible();
    expect(screen.getByText("New badge")).toBeVisible();
  });

  test("the Progress Badges are the SVG list as before, with no shelf line", async () => {
    renderMounted("/progress/", snapshotOf(overview, { course: fullCourse }));
    await screen.findByRole("heading", { level: 2, name: "Badges" });
    expect(badge()).toBeNull();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByText(SHELF_HINT)).toBeNull();
    expect(
      screen
        .getByRole("heading", { level: 2, name: "Badges" })
        .closest("section")?.className,
    ).toContain("bg-surface");
  });
});

describe("the Badge reveal, the Scene drawing", () => {
  test("plays once on a won first completion, with one light per passed Check line, then forms", async () => {
    const seen: Seen = { stage: null, events: [] };
    const said = await atComplete(seen);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "playing");
    });
    expect(badge()).toHaveAttribute("data-badge-lights", "2");
    const slots = seen.stage?.slots() ?? [];
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      lesson: "b-1",
      earned: true,
      size: "lg",
      reveal: { lights: 2, ms: 200, done: false },
    });
    // The 3D Badge stands in: the SVG stays in the page, named, see-through.
    const art = screen.getByRole("img", { name: "Explorer" });
    expect(slots[0]?.element).toBe(art);
    expect(badge()?.className).toContain("[&_svg[data-scene-shown]]:opacity-0");
    expect(seen.events).toEqual([
      { type: "start", lesson: "b-1", lights: 2, ms: 200, drawn: true },
    ]);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "formed");
    });
    expect(seen.events.map((e) => e.type)).toEqual(["start", "end"]);
    expect(slots[0]?.reveal?.done).toBe(true);
    // Its "New badge" line shows, and it is announced once.
    expect(screen.getByText("New badge")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(said()).toEqual(["New badge: Explorer"]);
  });

  test("any key skips it to the formed Badge, and the key is not held back", async () => {
    root.style.setProperty("--duration-reveal", "5000ms");
    const seen: Seen = { stage: null, events: [] };
    const said = await atComplete(seen);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "playing");
    });
    const key = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(key);
    });
    expect(key.defaultPrevented).toBe(false);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "formed");
    });
    expect(seen.events.map((e) => e.type)).toEqual(["start", "skip"]);
    expect(seen.stage?.slots()[0]?.reveal?.done).toBe(true);
    // Its own timer no longer ends it.
    await new Promise((r) => setTimeout(r, 50));
    expect(seen.events.map((e) => e.type)).toEqual(["start", "skip"]);
    expect(said()).toEqual(["New badge: Explorer"]);
  });

  test("a click skips it, and the click still does what it does", async () => {
    root.style.setProperty("--duration-reveal", "5000ms");
    const seen: Seen = { stage: null, events: [], at: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "playing");
    });
    await userEvent.click(
      screen.getByRole("link", { name: "Back to the learning journey" }),
    );
    expect(seen.events.map((e) => e.type)).toEqual(["start", "skip"]);
    // Skipped as the press came down, before the link went anywhere.
    expect(seen.at?.[1]).toBe("/lesson/b-1/complete/");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/journey/");
    });
    // The screen that left takes its 3D Badge with it.
    await waitFor(() => {
      expect(seen.stage?.slots()).toHaveLength(0);
    });
  });

  test("a replay of the Lesson reveals nothing: the formed Badge stands in, and nothing is told", async () => {
    const seen: Seen = { stage: null, events: [] };
    const said = await atComplete(seen, { ...complete, firstTime: false });
    expect(
      await screen.findByText("You already earned this badge."),
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(badge()).not.toHaveAttribute("data-badge-reveal");
    expect(seen.stage?.slots()).toMatchObject([
      { lesson: "b-1", earned: true, reveal: null },
    ]);
    expect(seen.events).toEqual([]);
    expect(said()).toEqual([]);
  });

  test("a reload or a second tab, whose milestone is already shown, reveals nothing", async () => {
    const seen: Seen = { stage: null, events: [] };
    const said = await atComplete(seen, complete, []);
    await new Promise((r) => setTimeout(r, 50));
    expect(badge()).not.toHaveAttribute("data-badge-reveal");
    expect(seen.stage?.slots()[0]?.reveal).toBeNull();
    expect(screen.queryByText("New badge")).toBeNull();
    expect(seen.events).toEqual([]);
    expect(said()).toEqual([]);
  });
});

describe("the Badge reveal, the still tier", () => {
  test.each([
    [
      "reduced motion",
      () => {
        stubReducedMotion(true);
      },
    ],
    [
      "no WebGL2",
      () => {
        vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
          null,
        );
      },
    ],
    [
      "Save-Data",
      () => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: Object.assign(new EventTarget(), { saveData: true }),
        });
      },
    ],
  ])(
    "under %s the formed SVG Badge shows at once with a short cross-fade, and no renderer loads",
    async (_name, probe) => {
      probe();
      const seen: Seen = { stage: null, events: [] };
      const scene = sceneSeeing(seen);
      const followed: BadgeRevealEvent[] = [];
      // A screen's own slot follows the reveal, as a sound outside the renderer would.
      function Follows(): null {
        useBadgeReveal((e) => {
          followed.push(e);
        });
        return null;
      }
      renderMounted(
        "/lesson/b-1/complete/",
        snapshotOf(complete, { milestones: completed }),
        { scene, slots: { lessonCompleteExtra: Follows } },
      );
      expect(
        await screen.findByText("New badge: Explorer"),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(badge()).toHaveAttribute("data-badge-reveal", "formed");
      });
      expect(badge()?.className).toContain("animate-cross-fade");
      expect(badge()?.className).not.toContain("opacity-0");
      // Never the SVG's pop: its shape starts where it ends.
      const shape = badge()?.querySelector<SVGElement>("[data-badge-shape]");
      expect(shape?.getAttribute("style") ?? "").not.toMatch(
        /scale|opacity: 0/,
      );
      expect(screen.getByRole("img", { name: "Explorer" })).toBeVisible();
      expect(screen.getByText("New badge")).toBeInTheDocument();
      await waitFor(() => {
        expect(followed.map((e) => e.type)).toEqual(["start", "end"]);
      });
      expect(followed[0]).toEqual({
        type: "start",
        lesson: "b-1",
        lights: 2,
        ms: 120,
        drawn: false,
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(scene.load).not.toHaveBeenCalled();
      expect(document.querySelector("[data-scene]")).toHaveAttribute(
        "data-scene-tier",
        "still",
      );
    },
  );
});

describe("the Badge shelf, the Scene drawing", () => {
  async function atShelf(seen: Seen): Promise<void> {
    const scene = sceneSeeing(seen);
    renderMounted("/progress/", snapshotOf(overview, { course: fullCourse }), {
      scene,
    });
    await screen.findByRole("heading", { level: 2, name: "Badges" });
    await waitFor(() => {
      expect(seen.stage?.drawing()).toBe(true);
    });
  }

  test("every Badge stands in 3D, the unearned as outlines, and the HTML list keeps its headings and names", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atShelf(seen);
    const section = screen
      .getByRole("heading", { level: 2, name: "Badges" })
      .closest("section");
    if (section === null) throw new Error("no Badges section");
    const shelf = within(section);
    await waitFor(() => {
      expect(seen.stage?.slots()).toHaveLength(23);
    });
    const slots = seen.stage?.slots() ?? [];
    expect(slots.filter((s) => s.earned).map((s) => s.lesson)).toEqual([
      "b-1",
      "b-2",
      "b-3",
    ]);
    expect(slots.every((s) => s.size === "sm" && s.reveal === null)).toBe(true);
    for (const level of ["Beginner", "Intermediate", "Advanced"])
      expect(
        shelf.getByRole("heading", { level: 3, name: level }),
      ).toBeVisible();
    // Every Badge keeps its name; the earned ones turn, the unearned do not.
    expect(shelf.getAllByRole("img")).toHaveLength(23);
    expect(
      shelf.getAllByRole("slider").map((s) => s.getAttribute("aria-label")),
    ).toEqual(["Explorer", "Planner", "Builder"]);
    expect(
      shelf.getByRole("img", { name: "Navigator, not yet" }),
    ).toBeInTheDocument();
    expect(shelf.getByText(SHELF_HINT)).toBeVisible();
    // The card has no surface of its own, so the 3D Badges behind it show.
    expect(section.className).not.toContain("bg-surface");
  });

  test("an earned Badge turns by the arrow keys while it has focus, and Home faces it front again", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atShelf(seen);
    const explorer = screen.getByRole("slider", { name: "Explorer" });
    const slot = () => seen.stage?.slots().find((s) => s.lesson === "b-1");
    explorer.focus();
    expect(explorer).toHaveFocus();
    const right = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      explorer.dispatchEvent(right);
    });
    expect(right.defaultPrevented).toBe(true);
    expect(slot()?.turn).toBeCloseTo(Math.PI / 8);
    expect(explorer).toHaveAttribute("aria-valuenow", "23");
    fireEvent.keyDown(explorer, { key: "ArrowLeft" });
    fireEvent.keyDown(explorer, { key: "ArrowLeft" });
    expect(slot()?.turn).toBeCloseTo(-Math.PI / 8);
    expect(explorer).toHaveAttribute("aria-valuenow", "338");
    fireEvent.keyDown(explorer, { key: "Home" });
    expect(slot()?.turn).toBe(0);
    // Tab is never captured: it moves on as ever.
    const tab = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      explorer.dispatchEvent(tab);
    });
    expect(tab.defaultPrevented).toBe(false);
    // Another Badge's turn is its own.
    expect(seen.stage?.slots().find((s) => s.lesson === "b-2")?.turn).toBe(0);
  });

  test("a drag across an earned Badge turns it", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atShelf(seen);
    const planner = screen.getByRole("slider", { name: "Planner" });
    planner.setPointerCapture = () => undefined;
    fireEvent.pointerDown(planner, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(planner, { clientX: 145, pointerId: 1 });
    fireEvent.pointerUp(planner, { clientX: 145, pointerId: 1 });
    fireEvent.pointerMove(planner, { clientX: 300, pointerId: 1 });
    expect(
      seen.stage?.slots().find((s) => s.lesson === "b-2")?.turn,
    ).toBeCloseTo(Math.PI / 4);
  });
});
