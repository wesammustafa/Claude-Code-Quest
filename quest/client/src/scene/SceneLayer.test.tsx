// Seam S12, the Scene's layer (09 9.2, 9.4): with the mount's switch on, one
// layer behind every screen, kept across navigation, told the screen, the
// Lesson, the Step and the phase; the frame's own background goes once it
// shows, except on a Lesson's step, where it is stopped; the screen's Pip
// stands down while the Scene holds Pip; the Scene's move plays each screen
// change. Without it the Local app is as it was. The renderer here is a
// stand-in: jsdom has no WebGL, and the real one is e2e's.
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from "vitest";
import {
  complete,
  completed,
  course,
  overview,
  playing,
  snapshotOf,
  stepDown,
} from "../../e2e/snapshots";
import { renderMounted } from "../../test/mounted";
import type {
  SceneMount,
  SceneProps,
  ScreenChange,
  ScreenTransitions,
} from "../mount/types";
import { usePipModel } from "../pip/PipStage";
import { useBadgeStage } from "./badges";
import { useSceneMove, useScenePip } from "./context";
import { resetTierProbes } from "./tier";
import { useCardPin } from "./workshop/pin";
import { useWorkshop, type Workshop } from "./workshop/store";

/** What the stand-in renderer heard: every props it rendered with, and how many renderers were made. */
interface Heard {
  props: SceneProps[];
  mounts: number;
}

let made = 0;

function standIn(
  heard: Heard,
  { holdsPip = false, move }: { holdsPip?: boolean; move?: SceneMove } = {},
) {
  function HoldsPip(): ReactNode {
    useScenePip();
    const model = usePipModel();
    return <span data-test-scene-pip={model.mode} />;
  }
  function Moves({ move: own }: { move: SceneMove }): null {
    useSceneMove(own);
    return null;
  }
  const ids = new Set<number>();
  return function StandIn(props: SceneProps): ReactNode {
    heard.props.push(props);
    // One id per renderer made: Strict Mode's second effect run keeps it.
    const [id] = useState(() => ++made);
    useEffect(() => {
      ids.add(id);
      heard.mounts = ids.size;
    }, [id]);
    return (
      <div data-test-scene="">
        <button
          type="button"
          tabIndex={-1}
          data-test-ready=""
          onClick={props.onReady}
        />
        <button
          type="button"
          tabIndex={-1}
          data-test-lost=""
          onClick={props.onLost}
        />
        {holdsPip && <HoldsPip />}
        {move && <Moves move={move} />}
      </div>
    );
  };
}

type SceneMove = (change: ScreenChange) => "under" | "instead";

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

function sceneWith(
  heard: Heard,
  options: Parameters<typeof standIn>[1] & {
    load?: SceneMount["load"];
    still?: SceneMount["still"];
  } = {},
): SceneMount & { load: ReturnType<typeof vi.fn> } {
  const View = standIn(heard, options);
  const load = vi.fn(
    options.load ?? (() => Promise.resolve({ default: View })),
  );
  return {
    load,
    look: LOOK,
    ...(options.still ? { still: options.still } : {}),
  };
}

/** A page that gives WebGL2, as a browser with a GPU does. */
function giveWebgl2(): void {
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    // A constructor the page can name; the probe never calls it.
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: () => undefined }),
  } as unknown as RenderingContext);
}

/** The system's media queries: the phone probe and reduced motion as given. */
function stubMedia({
  phone = false,
  reduced = false,
}: {
  phone?: boolean;
  reduced?: boolean;
}): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches:
        (query.startsWith("(pointer: coarse)") && phone) ||
        (query === "(prefers-reduced-motion: reduce)" && reduced),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

beforeEach(() => {
  resetTierProbes();
  giveWebgl2();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  delete document.documentElement.dataset.theme;
  Reflect.deleteProperty(navigator, "connection");
});

const layer = () => document.querySelector<HTMLElement>("[data-scene]");
const frame = () =>
  document.querySelector<HTMLElement>("[data-screen]")?.parentElement ?? null;
const last = (heard: Heard) => heard.props.at(-1);

/** Goes to `path` as a link would: the browser router follows popstate. */
function go(path: string): void {
  act(() => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

async function drawn(heard: Heard): Promise<void> {
  await waitFor(() => {
    expect(heard.mounts).toBeGreaterThan(0);
  });
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

afterEach(() => {
  Reflect.deleteProperty(document, "visibilityState");
});

describe("the Scene, off (the default)", () => {
  test("no layer, the frame paints its own background, and Pip is the screen's", async () => {
    renderMounted("/journey/", snapshotOf(overview));
    await screen.findByRole("heading", { level: 1 });
    expect(layer()).toBeNull();
    expect(frame()?.className).toBe(
      "min-h-dvh bg-bg bg-(image:--glow) bg-no-repeat",
    );
    expect(document.querySelector("[data-pip-stood-down]")).toBeNull();
    expect(document.querySelector('[data-pip="beside"]')).not.toBeNull();
  });
});

describe("the Scene, on", () => {
  test("is rendered once, outside the keyed screen, and kept across navigation", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const scene = sceneWith(heard);
    renderMounted("/journey/", snapshotOf(overview), { scene });
    await drawn(heard);
    const first = layer();
    expect(first?.closest("[data-screen]")).toBeNull();
    go("/progress/");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    go("/journey/");
    await waitFor(() => {
      expect(last(heard)?.screen.path).toBe("/journey");
    });
    expect(layer()).toBe(first);
    expect(heard.mounts).toBe(1);
    expect(scene.load).toHaveBeenCalledTimes(1);
  });

  test("is told the screen, the Lesson, the Step, the phase, its tier, the theme and its look", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    // The stored choice, which the mount puts on <html> as it starts.
    localStorage.setItem("quest.theme", "dark");
    {
      const page = renderMounted("/journey/", snapshotOf(overview), {
        scene: sceneWith(heard),
      });
      await drawn(heard);
      expect(last(heard)).toMatchObject({
        screen: { path: "/journey", screen: "map" },
        lesson: "b-1",
        phase: "overview",
        step: null,
        tier: "desktop",
        running: true,
        theme: "dark",
        look: LOOK.dark,
      });
      page.send(snapshotOf(playing, { revision: 2 }));
      go("/lesson/b-1/step/");
      await waitFor(() => {
        expect(last(heard)).toMatchObject({
          screen: { path: "/lesson/b-1/step", screen: "step" },
          lesson: "b-1",
          phase: "playing",
          step: playing.step?.id,
        });
      });
    }
  });

  test("tells the renderer every Lesson as its Station, a lab marked optional", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const withLab = {
      ...course,
      levels: course.levels.map((level) => ({
        ...level,
        lessons: level.lessons.map((l) =>
          l.id === "b-2" ? { ...l, optional: true } : l,
        ),
      })),
    };
    renderMounted("/journey/", snapshotOf(overview, { course: withLab }), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(last(heard)?.stations).toEqual([
      { lesson: "b-1", level: "beginner", optional: false, complete: false },
      { lesson: "b-2", level: "beginner", optional: true, complete: false },
    ]);
  });

  test("the frame keeps its background until the Scene has drawn, then paints none", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(frame()?.className).toContain("bg-bg");
    expect(frame()).not.toHaveAttribute("data-scene-behind");
    fireEvent.click(document.querySelector("[data-test-ready]") as Element);
    await waitFor(() => {
      expect(frame()).toHaveAttribute("data-scene-behind");
    });
    expect(frame()?.className).toBe("min-h-dvh");
  });

  test("stops on a Lesson's step and its Step-down, keeps its renderer and the frame's background there, and draws again after", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const page = renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    fireEvent.click(document.querySelector("[data-test-ready]") as Element);
    await waitFor(() => {
      expect(frame()).toHaveAttribute("data-scene-behind");
    });

    page.send(snapshotOf(playing, { revision: 2 }));
    go("/lesson/b-1/step/");
    await waitFor(() => {
      expect(last(heard)?.running).toBe(false);
    });
    expect(layer()).toHaveAttribute("data-scene-stopped");
    expect(layer()?.className).toContain("invisible");
    expect(frame()).not.toHaveAttribute("data-scene-behind");
    expect(frame()?.className).toContain("bg-bg");

    page.send(snapshotOf(stepDown, { revision: 3 }));
    await waitFor(() => {
      expect(last(heard)).toMatchObject({
        phase: "step-down",
        screen: { screen: "levelup" },
        running: false,
      });
    });
    expect(frame()?.className).toContain("bg-bg");

    go("/journey/");
    await waitFor(() => {
      expect(last(heard)?.running).toBe(true);
    });
    expect(layer()).not.toHaveAttribute("data-scene-stopped");
    expect(frame()).toHaveAttribute("data-scene-behind");
    expect(heard.mounts).toBe(1);
  });

  test("a page opened on a Lesson's step loads nothing until a screen that shows the Scene", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const scene = sceneWith(heard);
    renderMounted("/lesson/b-1/step/", snapshotOf(playing), { scene });
    await screen.findByRole("heading", { level: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(scene.load).not.toHaveBeenCalled();
    go("/journey/");
    await drawn(heard);
    expect(scene.load).toHaveBeenCalledTimes(1);
  });

  test("pauses while the page is hidden and runs again when it shows", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(last(heard)?.running).toBe(true);
    setHidden(true);
    expect(last(heard)?.running).toBe(false);
    setHidden(false);
    expect(last(heard)?.running).toBe(true);
  });

  test("the layer is aria-hidden and inert, and focus moves to the screen's heading as before", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(layer()).toHaveAttribute("aria-hidden", "true");
    expect(layer()).toHaveAttribute("inert");
    go("/progress/");
    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Progress",
    });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});

describe("Pip and the Scene", () => {
  test("while the Scene holds Pip the screen's Pip stands down, and the Scene's Pip reads the one director", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, { holdsPip: true }),
    });
    await drawn(heard);
    await waitFor(() => {
      expect(document.querySelector("[data-pip-stood-down]")).not.toBeNull();
    });
    expect(
      document.querySelectorAll("[data-pip]:not([data-pip=icon])"),
    ).toHaveLength(0);
    const scenePip = () =>
      document
        .querySelector("[data-test-scene-pip]")
        ?.getAttribute("data-test-scene-pip");
    expect(scenePip()).toBe("idle");
    // The director rests Pip on a hidden page: the Scene's Pip follows it.
    setHidden(true);
    await waitFor(() => {
      expect(scenePip()).toBe("rest");
    });
  });

  test("a Scene that does not hold Pip leaves the screen's Pip as it is", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(document.querySelector("[data-pip-stood-down]")).toBeNull();
    expect(document.querySelector('[data-pip="beside"]')).not.toBeNull();
  });
});

describe("the Scene's move (seam S11's host hook)", () => {
  test("plays each route change ahead of the mount's own move", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const changes: string[] = [];
    const own = vi.fn((): "under" => "under");
    const transitions: ScreenTransitions = { move: own };
    renderMounted("/journey/", snapshotOf(overview), {
      transitions,
      scene: sceneWith(heard, {
        move: (change) => {
          changes.push(`${change.from.screen}>${change.to.screen}`);
          return "instead";
        },
      }),
    });
    await drawn(heard);
    go("/progress/");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(changes).toEqual(["map>progress"]);
    expect(own).not.toHaveBeenCalled();
    // "instead": no leaving copy of the screen.
    expect(document.querySelectorAll("[data-screen-leaving]")).toHaveLength(0);
  });

  test("without a registered move the mount's own move plays", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const own = vi.fn((): "under" => "under");
    renderMounted("/journey/", snapshotOf(overview), {
      transitions: { move: own },
      scene: sceneWith(heard),
    });
    await drawn(heard);
    go("/progress/");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(own).toHaveBeenCalledTimes(1);
  });
});

describe("the tiers", () => {
  const still = ({ theme }: { theme: string }) => `/still-${theme}.webp`;

  test("a phone draws at its own tier", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    stubMedia({ phone: true });
    // The breakpoint token the phone query is built from, as tokens.css declares it.
    const style = document.createElement("style");
    style.textContent = ":root { --breakpoint-md: 48rem; }";
    document.head.append(style);
    onTestFinished(() => {
      style.remove();
    });
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(last(heard)?.tier).toBe("phone");
    expect(layer()).toHaveAttribute("data-scene-tier", "phone");
  });

  for (const [name, set] of [
    ["no WebGL2", () => vi.stubGlobal("WebGL2RenderingContext", undefined)],
    [
      "reduced motion, the system's",
      () => {
        stubMedia({ reduced: true });
      },
    ],
    [
      "reduced motion, the app's own",
      () => {
        localStorage.setItem("quest.motion", "reduce");
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
    [
      "Save-Data, from a connection that tells no change",
      () => {
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: { saveData: true },
        });
      },
    ],
  ] as const)
    test(`${name}: the still shows, no renderer loads, and the frame drops its background once the still has loaded`, async () => {
      set();
      const heard: Heard = { props: [], mounts: 0 };
      const scene = sceneWith(heard, { still });
      renderMounted("/journey/", snapshotOf(overview), { scene });
      await screen.findByRole("heading", { level: 1 });
      const img = await waitFor(() => {
        const found =
          document.querySelector<HTMLImageElement>("[data-scene-still]");
        expect(found).not.toBeNull();
        return found as HTMLImageElement;
      });
      expect(img.getAttribute("src")).toBe("/still-light.webp");
      expect(img).toHaveAttribute("alt", "");
      expect(layer()).toHaveAttribute("data-scene-tier", "still");
      expect(frame()).not.toHaveAttribute("data-scene-behind");
      fireEvent.load(img);
      await waitFor(() => {
        expect(frame()).toHaveAttribute("data-scene-behind");
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(scene.load).not.toHaveBeenCalled();
      expect(heard.mounts).toBe(0);
    });

  test("a change between the desktop and phone tiers makes a new renderer, so the new tier's context attributes apply", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const changed = new Set<() => void>();
    let phone = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        get matches() {
          return query.startsWith("(pointer: coarse)") && phone;
        },
        media: query,
        addEventListener: (_: string, fn: () => void) => changed.add(fn),
        removeEventListener: (_: string, fn: () => void) => changed.delete(fn),
      })),
    );
    const style = document.createElement("style");
    style.textContent = ":root { --breakpoint-md: 48rem; }";
    document.head.append(style);
    onTestFinished(() => {
      style.remove();
    });
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard),
    });
    await drawn(heard);
    expect(last(heard)?.tier).toBe("desktop");
    expect(heard.mounts).toBe(1);
    act(() => {
      phone = true;
      for (const fn of changed) fn();
    });
    await waitFor(() => {
      expect(last(heard)?.tier).toBe("phone");
    });
    await waitFor(() => {
      expect(heard.mounts).toBe(2);
    });
  });

  test("the tier follows its inputs: the app's motion switch swaps the drawn Scene for the still and back", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, { still }),
    });
    await drawn(heard);
    expect(document.querySelector("[data-test-scene]")).not.toBeNull();
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(document.querySelector("[data-scene-still]")).not.toBeNull();
    });
    expect(document.querySelector("[data-test-scene]")).toBeNull();
    await act(async () => {
      delete document.documentElement.dataset.motion;
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(document.querySelector("[data-test-scene]")).not.toBeNull();
    });
  });
});

describe("failures", () => {
  const still = ({ theme }: { theme: string }) => `/still-${theme}.webp`;

  test("a renderer that fails to load leaves the still", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, {
        still,
        load: () => Promise.reject(new Error("chunk refused")),
      }),
    });
    await waitFor(() => {
      expect(document.querySelector("[data-scene-still]")).not.toBeNull();
    });
  });

  test("a failed load with no still leaves the screens as they are without the Scene", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const scene = sceneWith(heard, {
      load: () => Promise.reject(new Error("chunk refused")),
    });
    renderMounted("/journey/", snapshotOf(overview), { scene });
    await waitFor(() => {
      expect(scene.load).toHaveBeenCalled();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(document.querySelector("[data-scene-still]")).toBeNull();
    expect(frame()?.className).toBe(
      "min-h-dvh bg-bg bg-(image:--glow) bg-no-repeat",
    );
    await screen.findByRole("heading", { level: 1 });
  });

  test("a still that fails to load leaves the frame's own background", async () => {
    stubMedia({ reduced: true });
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, { still }),
    });
    const img = await waitFor(() => {
      const found = document.querySelector("[data-scene-still]");
      expect(found).not.toBeNull();
      return found as Element;
    });
    fireEvent.error(img);
    await new Promise((r) => setTimeout(r, 20));
    expect(frame()).not.toHaveAttribute("data-scene-behind");
  });

  test("a lost WebGL context hands over to the still", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, { still }),
    });
    await drawn(heard);
    fireEvent.click(document.querySelector("[data-test-lost]") as Element);
    await waitFor(() => {
      expect(document.querySelector("[data-scene-still]")).not.toBeNull();
    });
    expect(document.querySelector("[data-test-scene]")).toBeNull();
  });

  test("a renderer that throws hands over to the still, and the screen stays", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Throws(): ReactNode {
      throw new Error("Error creating WebGL context");
    }
    renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneWith(heard, {
        still,
        load: () => Promise.resolve({ default: Throws }),
      }),
    });
    await waitFor(() => {
      expect(document.querySelector("[data-scene-still]")).not.toBeNull();
    });
    await screen.findByRole("heading", { level: 1 });
  });
});

describe("a first completion's Station (09 9.3)", () => {
  const root = document.documentElement;
  afterEach(() => {
    root.removeAttribute("style");
  });

  /** A renderer that draws the stage's Badges, so Lesson complete's reveal plays in 3D. */
  function sceneDrawingBadges(heard: Heard): SceneMount {
    function Draws(props: SceneProps): ReactNode {
      heard.props.push(props);
      const stage = useBadgeStage();
      useEffect(() => stage.attach(), [stage]);
      useEffect(() => {
        heard.mounts = 1;
      }, []);
      return <div data-test-scene="" />;
    }
    return {
      load: vi.fn(() => Promise.resolve({ default: Draws })),
      look: LOOK,
    };
  }

  const doneCourse = {
    ...course,
    levels: course.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((l) =>
        l.id === "b-1" ? { ...l, complete: true } : l,
      ),
    })),
  };
  const litOf = (props: SceneProps | undefined) =>
    props?.stations.find((s) => s.lesson === "b-1")?.complete;

  /** b-1 played from the Journey to its first completion, its Lesson complete on show. */
  async function firstCompletion(heard: Heard): Promise<number> {
    const page = renderMounted("/journey/", snapshotOf(overview), {
      scene: sceneDrawingBadges(heard),
    });
    await drawn(heard);
    expect(litOf(last(heard))).toBe(false);
    page.send(snapshotOf(playing, { revision: 2 }));
    go("/lesson/b-1/step/");
    const from = heard.props.length;
    page.send(
      snapshotOf(complete, {
        revision: 3,
        course: doneCourse,
        milestones: completed,
      }),
    );
    go("/lesson/b-1/complete/");
    await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
    await waitFor(() => {
      expect(document.querySelector("[data-badge-reveal]")).toHaveAttribute(
        "data-badge-reveal",
        "playing",
      );
    });
    return from;
  }

  test("stays unlit while the Badge reveal plays and lights at its end, and the Journey shows it lit", async () => {
    root.style.setProperty("--duration-reveal", "300ms");
    const heard: Heard = { props: [], mounts: 0 };
    const from = await firstCompletion(heard);
    // Never drawn lit from the completion until the reveal ends.
    expect(heard.props.slice(from).map(litOf)).not.toContain(true);
    await waitFor(() => {
      expect(litOf(last(heard))).toBe(true);
    });
    expect(document.querySelector("[data-badge-reveal]")).toHaveAttribute(
      "data-badge-reveal",
      "formed",
    );
    go("/journey/");
    await waitFor(() => {
      expect(last(heard)?.screen.path).toBe("/journey");
    });
    expect(litOf(last(heard))).toBe(true);
  });

  test("a key that skips the reveal lights it at once", async () => {
    root.style.setProperty("--duration-reveal", "60s");
    const heard: Heard = { props: [], mounts: 0 };
    await firstCompletion(heard);
    expect(litOf(last(heard))).toBe(false);
    fireEvent.keyDown(document.body, { key: "Tab" });
    await waitFor(() => {
      expect(litOf(last(heard))).toBe(true);
    });
  });

  test("a Lesson already complete when the page opens is lit at once", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    renderMounted(
      "/lesson/b-1/complete/",
      snapshotOf(complete, { course: doneCourse }),
      { scene: sceneDrawingBadges(heard) },
    );
    await drawn(heard);
    expect(heard.props.map(litOf)).not.toContain(false);
  });
});

describe("a first completion's pin and Celebration (the warm workshop, D10)", () => {
  const root = document.documentElement;
  afterEach(() => {
    root.removeAttribute("style");
  });

  const scene = () => document.querySelector<HTMLElement>("[data-test-scene]");
  const pinning = () => scene()?.dataset.testPin;
  const reaction = () => scene()?.dataset.testReaction;

  const doneB1 = {
    ...course,
    levels: course.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((l) =>
        l.id === "b-1" ? { ...l, complete: true } : l,
      ),
    })),
  };
  const litOf = (props: SceneProps | undefined) =>
    props?.stations.find((s) => s.lesson === "b-1")?.complete;

  /** The room's Pip, holding Pip once his model has loaded, a moment after the renderer; the test walks him to his place. */
  function LoadsPip(): ReactNode {
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
      const at = setTimeout(() => {
        setLoaded(true);
      }, 50);
      return () => {
        clearTimeout(at);
      };
    }, []);
    return loaded ? <HoldsPip /> : null;
  }
  let room: Workshop | null = null;
  function HoldsPip(): null {
    useScenePip();
    const workshop = useWorkshop();
    useEffect(() => {
      room = workshop;
    }, [workshop]);
    return null;
  }

  /** A renderer that draws the stage's Badges and shows the card pinning now and Pip's Reaction; with `pip`, its own Pip holds Pip once loaded. */
  function staging(heard: Heard, pins: string[], pip = false): SceneMount {
    function Draws(props: SceneProps): ReactNode {
      heard.props.push(props);
      const stage = useBadgeStage();
      useEffect(() => stage.attach(), [stage]);
      useEffect(() => {
        heard.mounts = 1;
      }, []);
      const pin = useCardPin();
      useEffect(() => {
        if (pin !== null) pins.push(pin.lesson);
      }, [pin]);
      return (
        <div
          data-test-scene=""
          data-test-pin={pin?.lesson ?? ""}
          data-test-reaction={usePipModel().reaction?.kind ?? ""}
        >
          {pip && <LoadsPip />}
        </div>
      );
    }
    return {
      load: vi.fn(() => Promise.resolve({ default: Draws })),
      look: LOOK,
      ...(pip ? { pip: true } : {}),
    };
  }

  /**
   * b-1 played to its complete screen: the course and the milestone the
   * host published once its save landed; a lesson.completed milestone
   * reaches the page only through the snapshot, and Pip through its claim.
   */
  async function played(
    heard: Heard,
    pins: string[],
    {
      before,
      firstTime,
      milestone,
    }: { before: typeof course; firstTime: boolean; milestone: boolean },
  ): Promise<void> {
    const page = renderMounted(
      "/journey/",
      snapshotOf(overview, { course: before }),
      {
        scene: staging(heard, pins),
      },
    );
    await drawn(heard);
    page.send(snapshotOf(playing, { revision: 2, course: before }));
    go("/lesson/b-1/step/");
    page.send(
      snapshotOf(
        { ...complete, firstTime },
        {
          revision: 3,
          course: doneB1,
          ...(milestone ? { milestones: completed } : {}),
        },
      ),
    );
    go("/lesson/b-1/complete/");
    await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
  }

  test("the card stays up unpinned through the reveal of the milestone this tab won, pins at its end, and only then does Pip celebrate", async () => {
    root.style.setProperty("--duration-reveal", "300ms");
    root.style.setProperty("--duration-moment", "200ms");
    const heard: Heard = { props: [], mounts: 0 };
    const pins: string[] = [];
    await played(heard, pins, {
      before: course,
      firstTime: true,
      milestone: true,
    });
    await waitFor(() => {
      expect(document.querySelector("[data-badge-reveal]")).toHaveAttribute(
        "data-badge-reveal",
        "playing",
      );
    });
    expect(litOf(last(heard))).toBe(false);
    expect(pinning()).toBe("");
    expect(reaction()).not.toBe("celebration");
    await waitFor(() => {
      expect(pinning()).toBe("b-1");
    });
    expect(litOf(last(heard))).toBe(true);
    expect(reaction()).not.toBe("celebration");
    await waitFor(() => {
      expect(reaction()).toBe("celebration");
    });
    expect(pinning()).toBe("");
    expect(pins).toEqual(["b-1"]);
  });

  test("a replay's complete screen shows the card pinned at once, with no pin and no Celebration", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const pins: string[] = [];
    await played(heard, pins, {
      before: doneB1,
      firstTime: false,
      milestone: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(heard.props.map(litOf)).not.toContain(false);
    expect(pins).toEqual([]);
    expect(reaction()).not.toBe("celebration");
  });

  test("a first completion whose milestone this tab did not win pins nothing and celebrates nowhere, and the Journey shows it lit", async () => {
    const heard: Heard = { props: [], mounts: 0 };
    const pins: string[] = [];
    await played(heard, pins, {
      before: course,
      firstTime: true,
      milestone: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(document.querySelector("[data-badge-reveal]")).toBeNull();
    expect(litOf(last(heard))).toBe(false);
    go("/journey/");
    await waitFor(() => {
      expect(litOf(last(heard))).toBe(true);
    });
    expect(pins).toEqual([]);
    expect(reaction()).not.toBe("celebration");
  });

  // U3 finding 1 on a cold renderer: a reload on the step loads nothing
  // (the Scene stops there), so on Lesson complete the renderer and then
  // its Pip arrive after a short cross-faded reveal has ended, and he
  // walks in from the room's edge. A pin that did not wait for him let the
  // Celebration play on the screen's own Pip, or on him out of view.
  test("on a renderer still loading when the reveal ends, the card pins only once the Scene's Pip stands at its place, and he celebrates there", async () => {
    root.style.setProperty("--duration-cross-fade", "60ms");
    root.style.setProperty("--duration-moment", "60ms");
    // Well within the wait for him (PIN_WAIT).
    root.style.setProperty("--says-hold", "5s");
    const heard: Heard = { props: [], mounts: 0 };
    const pins: string[] = [];
    let arrive = (): void => undefined;
    const arrived = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    const drawing = staging(heard, pins, true);
    const page = renderMounted(
      "/lesson/b-1/step/",
      snapshotOf(playing, { course }),
      {
        scene: {
          ...drawing,
          load: vi.fn(() => arrived.then(() => drawing.load())),
        },
      },
    );
    await screen.findByRole("heading", { level: 1 });
    page.send(
      snapshotOf(
        { ...complete, firstTime: true },
        { revision: 2, course: doneB1, milestones: completed },
      ),
    );
    go("/lesson/b-1/complete/");
    await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
    await waitFor(() => {
      expect(document.querySelector("[data-badge-reveal]")).toHaveAttribute(
        "data-badge-reveal",
        "formed",
      );
    });
    // Past the reveal and a pin's length: nothing pinned, and the screen's
    // own Pip, the one on show, plays no Celebration.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(pins).toEqual([]);
    expect(document.querySelector("[data-pip-reaction]")).toBeNull();
    act(() => {
      arrive();
    });
    await drawn(heard);
    // Held, the screen's own Pip stood down, but still walking in.
    await waitFor(() => {
      expect(document.querySelector("[data-pip-stood-down]")).not.toBeNull();
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(pins).toEqual([]);
    expect(litOf(last(heard))).toBe(false);
    act(() => {
      room?.setStatus({ activity: "idle", at: "noticeboard" });
    });
    await waitFor(() => {
      expect(pinning()).toBe("b-1");
    });
    expect(reaction()).not.toBe("celebration");
    await waitFor(() => {
      expect(reaction()).toBe("celebration");
    });
    expect(pins).toEqual(["b-1"]);
    expect(document.querySelector("[data-pip-reaction]")).toBeNull();
  });

  test("a Pip who never reaches the card's place leaves nothing staged: past the wait after the reveal, the card pins anyway and he celebrates where he stands", async () => {
    root.style.setProperty("--duration-reveal", "100ms");
    root.style.setProperty("--duration-moment", "60ms");
    root.style.setProperty("--says-hold", "300ms");
    const heard: Heard = { props: [], mounts: 0 };
    const pins: string[] = [];
    const page = renderMounted("/journey/", snapshotOf(overview, { course }), {
      scene: staging(heard, pins, true),
    });
    await drawn(heard);
    await waitFor(() => {
      expect(document.querySelector("[data-pip-stood-down]")).not.toBeNull();
    });
    page.send(snapshotOf(playing, { revision: 2, course }));
    go("/lesson/b-1/step/");
    page.send(
      snapshotOf(
        { ...complete, firstTime: true },
        { revision: 3, course: doneB1, milestones: completed },
      ),
    );
    go("/lesson/b-1/complete/");
    await screen.findByRole("heading", { level: 1, name: /Install, sign in/ });
    await waitFor(() => {
      expect(document.querySelector("[data-badge-reveal]")).toHaveAttribute(
        "data-badge-reveal",
        "formed",
      );
    });
    // He stands elsewhere: within the wait nothing pins.
    act(() => {
      room?.setStatus({ activity: "idle", at: "bench" });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pins).toEqual([]);
    expect(reaction()).not.toBe("celebration");
    await waitFor(() => {
      expect(reaction()).toBe("celebration");
    });
    expect(pins).toEqual(["b-1"]);
    expect(litOf(last(heard))).toBe(true);
  });
});
