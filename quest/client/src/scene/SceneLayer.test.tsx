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
import { overview, playing, snapshotOf, stepDown } from "../../e2e/snapshots";
import { renderMounted } from "../../test/mounted";
import type {
  SceneMount,
  SceneProps,
  ScreenChange,
  ScreenTransitions,
} from "../mount/types";
import { usePipModel } from "../pip/PipStage";
import { useSceneMove, useScenePip } from "./context";
import { resetTierProbes } from "./tier";

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
  },
  dark: {
    sky: "#0b1020",
    ground: "#1f2a4d",
    light: "#ffd9c9",
    ambient: 2.6,
    key: 2.4,
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
