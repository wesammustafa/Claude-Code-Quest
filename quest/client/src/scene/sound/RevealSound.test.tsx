// The Badge reveal's sound (09 9.3, 9.5): the Scene's sound hears the
// reveal through `useBadgeReveal`, plays "badge-reveal" within a drawn
// reveal's length and cuts it short on its skip. The still tier's
// cross-fade, a reload or second tab, a replay, mute and the Practice
// terminal's busy mark play nothing. The renderer is a stand-in that draws
// the stage's Badges (jsdom has no WebGL), the audio a stand-in that keeps
// every note.
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { complete, completed, snapshotOf } from "../../../e2e/snapshots";
import {
  FakeAudioContext,
  resetAudio,
  startedNotes,
} from "../../../test/audio";
import { renderMounted } from "../../../test/mounted";
import { stubReducedMotion } from "../../../test/motion";
import type { SceneMount } from "../../mount/types";
import {
  useBadgeReveal,
  useBadgeStage,
  type BadgeRevealEvent,
  type BadgeStage,
} from "../badges";
import { resetTierProbes } from "../tier";
import { CUES } from "./cues";

interface Seen {
  stage: BadgeStage | null;
  events: BadgeRevealEvent[];
}

const LOOK = {
  light: {
    sky: "#fbf6ef",
    ground: "#f0e5d5",
    light: "#fff6ee",
    ambient: 2.9,
    key: 1,
    landscape: {
      meadow: "#eef0de",
      path: "#f6ecdc",
      stone: "#ece2d4",
      lit: "#ffd6c4",
      foliage: "#dde9dc",
    },
  },
  dark: {
    sky: "#0b1020",
    ground: "#1f2a4d",
    light: "#ffd9c9",
    ambient: 2.6,
    key: 2.4,
    landscape: {
      meadow: "#17223f",
      path: "#26315a",
      stone: "#2a3458",
      lit: "#5c2e22",
      foliage: "#142a3a",
    },
  },
};

/** A renderer that draws the stage's Badges, as SceneBadges does, and notes the reveal's events. */
function sceneSeeing(seen: Seen): SceneMount {
  function Draws(): ReactNode {
    const stage = useBadgeStage();
    useEffect(() => {
      seen.stage = stage;
      return stage.attach();
    }, [stage]);
    useBadgeReveal((event) => {
      seen.events.push(event);
    });
    return <div data-test-scene="" />;
  }
  return {
    load: () => Promise.resolve({ default: Draws }),
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
const REVEAL = CUES["badge-reveal"];

beforeEach(() => {
  resetTierProbes();
  resetAudio();
  giveWebgl2();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  root.style.setProperty("--duration-reveal", "5000ms");
  root.style.setProperty("--duration-cross-fade", "120ms");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  root.removeAttribute("style");
  localStorage.clear();
  document.querySelector("[data-test-pane]")?.remove();
});

function go(path: string): void {
  act(() => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const badge = () => document.querySelector<HTMLElement>("[data-scene-badge]");

/**
 * Lesson complete, reached from the Journey once the renderer draws, after
 * the Learner's first interaction (a click on the page), as a Learner
 * reaches it.
 */
async function atComplete(
  seen: Seen,
  lesson = complete,
  milestones = completed,
): Promise<void> {
  renderMounted("/journey/", snapshotOf(lesson, { milestones }), {
    scene: sceneSeeing(seen),
  });
  await screen.findByRole("heading", { level: 1 });
  await waitFor(() => {
    expect(seen.stage?.drawing()).toBe(true);
  });
  await userEvent.click(document.body);
  go("/lesson/b-1/complete/");
  await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
}

const pause = () => new Promise((r) => setTimeout(r, 50));

describe("the Badge reveal's sound", () => {
  test("a drawn reveal plays the badge-reveal cue on its start, within the reveal's length", async () => {
    root.style.setProperty("--duration-reveal", "300ms");
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(seen.events[0]).toMatchObject({ type: "start", drawn: true });
    });
    // Within 300 ms the cue's notes that start by then ring, and end by then.
    const within = REVEAL.filter((note) => note.at < 0.3);
    expect(startedNotes()).toHaveLength(within.length);
    const first = startedNotes()[0]?.started ?? 0;
    for (const osc of startedNotes())
      expect(osc.stopped).toBeLessThanOrEqual(first + 0.3 + 0.05);
    // Run to its end, the cue is let fade, not cut.
    await waitFor(() => {
      expect(seen.events.map((e) => e.type)).toEqual(["start", "end"]);
    });
    expect(startedNotes().at(-1)?.stopped).toBeGreaterThan(first + 0.25);
  });

  test("a key that skips the reveal cuts its cue short", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(badge()).toHaveAttribute("data-badge-reveal", "playing");
    });
    expect(startedNotes()).toHaveLength(REVEAL.length);
    expect(startedNotes().at(-1)?.stopped).toBeGreaterThan(1);
    await userEvent.keyboard("a");
    expect(seen.events.map((e) => e.type)).toEqual(["start", "skip"]);
    for (const osc of startedNotes()) expect(osc.stopped).toBeLessThan(0.1);
  });

  test("a click that skips the reveal and leaves the screen cuts its cue short", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(startedNotes()).toHaveLength(REVEAL.length);
    });
    await userEvent.click(
      screen.getByRole("link", { name: "Back to the learning journey" }),
    );
    await waitFor(() => {
      expect(window.location.pathname).toBe("/journey/");
    });
    expect(seen.events.map((e) => e.type)).toEqual(["start", "skip"]);
    const reveal = startedNotes().slice(0, REVEAL.length);
    for (const osc of reveal) expect(osc.stopped).toBeLessThan(0.1);
  });

  test("muted, a drawn reveal plays nothing", async () => {
    localStorage.setItem("quest.sound", "off");
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(seen.events[0]).toMatchObject({ type: "start", drawn: true });
    });
    await pause();
    // A muted gesture makes no audio at all.
    expect(FakeAudioContext.made).toHaveLength(0);
    expect(startedNotes()).toHaveLength(0);
  });

  test("while the Practice terminal is busy, a drawn reveal plays nothing", async () => {
    const pane = document.createElement("div");
    pane.setAttribute("data-practice-pane", "");
    pane.setAttribute("data-test-pane", "");
    pane.append(document.createElement("span"));
    pane.firstElementChild?.setAttribute("data-practice-busy", "");
    document.body.append(pane);
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen);
    await waitFor(() => {
      expect(seen.events[0]).toMatchObject({ type: "start", drawn: true });
    });
    await pause();
    expect(startedNotes()).toHaveLength(0);
  });

  test("a replay of the Lesson plays nothing", async () => {
    const replay: Seen = { stage: null, events: [] };
    await atComplete(replay, { ...complete, firstTime: false });
    await screen.findByText("You already earned this badge.");
    await pause();
    expect(replay.events).toEqual([]);
    expect(startedNotes()).toHaveLength(0);
  });

  test("a reload or a second tab, whose milestone is already shown, plays nothing", async () => {
    const seen: Seen = { stage: null, events: [] };
    await atComplete(seen, complete, []);
    await pause();
    expect(seen.events).toEqual([]);
    expect(startedNotes()).toHaveLength(0);
  });
});

describe("the Badge reveal's sound, the still tier", () => {
  test("under reduced motion the cross-fade plays nothing", async () => {
    stubReducedMotion(true);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const followed: BadgeRevealEvent[] = [];
    function Follows(): null {
      useBadgeReveal((e) => {
        followed.push(e);
      });
      return null;
    }
    renderMounted(
      "/journey/",
      snapshotOf(complete, { milestones: completed }),
      {
        scene: sceneSeeing({ stage: null, events: [] }),
        slots: { lessonCompleteExtra: Follows },
      },
    );
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(document.body);
    go("/lesson/b-1/complete/");
    await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
    await waitFor(() => {
      expect(followed.map((e) => e.type)).toEqual(["start", "end"]);
    });
    expect(followed[0]).toMatchObject({ drawn: false, ms: 120 });
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(startedNotes()).toHaveLength(0);
  });
});
