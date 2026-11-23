// The Journey path (09 9.3, 9.4, ticket 52), on the mounted client with
// the Scene on: once the renderer draws, the Beginner Lessons are a path
// with a stage band; focus on a Lesson link, the arrow keys, a swipe or a
// drag, a pinch, a scroll and the pull-back control move Pip and the
// camera, and a tap on a Station opens exactly what its link opens. The
// screen's Pip stands down for the 2D Pip floating over the Scene. The
// Stations are lit from the snapshot alone. With the Scene off, and on
// the other Levels, the Journey is as it was. The renderer is a stand-in
// that draws each Station where the test says: jsdom has no WebGL.
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useContext, useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fullCourse, overview, snapshotOf } from "../../e2e/snapshots";
import { renderMounted } from "../../test/mounted";
import type { SceneMount, SceneProps } from "../mount/types";
import { SceneContext } from "./context";
import { WHOLE_LEVEL } from "./JourneyStage";
import { journeyPathOf, type JourneyPath, type StationPoint } from "./path";
import { resetTierProbes } from "./tier";

const BEGINNER = ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone"];

/** Where the stand-in draws each Station: 100 px apart along one line. */
const POINTS: StationPoint[] = BEGINNER.map((lesson, i) => ({
  lesson,
  x: 100 + i * 100,
  y: 200,
  r: 30,
  lit: false,
}));

interface Heard {
  props: SceneProps[];
  path: JourneyPath | null;
}

function sceneWith(heard: Heard): SceneMount {
  function StandIn(props: SceneProps): ReactNode {
    heard.props.push(props);
    const path = journeyPathOf(useContext(SceneContext));
    useEffect(() => {
      heard.path = path;
      path.setReady(true);
      path.setView({ points: POINTS, pip: { x: 100, y: 230 } });
      return () => {
        path.setReady(false);
      };
    }, [path]);
    return <div data-test-scene="" />;
  }
  return {
    load: () => Promise.resolve({ default: StandIn }),
    look: {
      light: {
        sky: "#ffffff",
        ground: "#eeeeee",
        light: "#ffffff",
        ambient: 3,
        key: 1,
        landscape: {
          meadow: "#eeeeee",
          path: "#f5f5f5",
          stone: "#eeeeee",
          lit: "#ffdddd",
          foliage: "#eeffee",
        },
      },
      dark: {
        sky: "#000000",
        ground: "#111111",
        light: "#ffffff",
        ambient: 2,
        key: 2,
        landscape: {
          meadow: "#111111",
          path: "#121212",
          stone: "#131313",
          lit: "#331111",
          foliage: "#112211",
        },
      },
    },
  };
}

beforeEach(() => {
  resetTierProbes();
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {
    // A constructor the page can name; the probe never calls it.
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext: () => undefined }),
  } as unknown as RenderingContext);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

const stage = () => document.querySelector<HTMLElement>("[data-journey-stage]");
const link = (lesson: string) =>
  document.querySelector<HTMLAnchorElement>(`a[href="/lesson/${lesson}/"]`);

/** The Journey of the full course, b-1 to b-3 complete, with the Scene drawing. */
async function onPath(): Promise<{
  heard: Heard;
  page: ReturnType<typeof renderMounted>;
  path: JourneyPath;
}> {
  const heard: Heard = { props: [], path: null };
  const page = renderMounted(
    "/journey/",
    snapshotOf(overview, { course: fullCourse }),
    { scene: sceneWith(heard) },
  );
  await waitFor(() => {
    expect(stage()).not.toBeNull();
  });
  if (heard.path === null) throw new Error("the stand-in never drew");
  return { heard, page, path: heard.path };
}

function press(
  el: Element,
  points: readonly { id: number; x: number; y: number }[],
  type: "pointerDown" | "pointerMove" | "pointerUp",
): void {
  for (const p of points)
    fireEvent[type](el, { pointerId: p.id, clientX: p.x, clientY: p.y });
}

describe("the Journey path, with the Scene drawing", () => {
  test("the Beginner Lessons get a stage band, the screen's Pip stands down and the 2D Pip floats where the Scene puts his feet", async () => {
    const { path } = await onPath();
    expect(document.querySelector("[data-pip-stood-down]")).not.toBeNull();
    const pip = document.querySelector<HTMLElement>("[data-scene-pip]");
    expect(pip?.hidden).toBe(false);
    expect(pip?.style.transform).toContain("translate(100px, 230px)");
    expect(pip?.closest("[aria-hidden]")).not.toBeNull();
    // Pip starts at the Learner's place: the overview's Lesson, b-1.
    expect(path.at()).toBe("b-1");
    expect(
      screen.getByRole("button", { name: WHOLE_LEVEL, pressed: false }),
    ).toBeVisible();
  });

  test("each Station's mark is drawn where the Scene drew it, lit as it drew it", async () => {
    const { path } = await onPath();
    act(() => {
      path.setView({
        points: POINTS.map((p, i) => ({ ...p, lit: i < 3 })),
        pip: null,
      });
    });
    const b2 = document.querySelector<HTMLElement>('[data-station="b-2"]');
    expect(b2?.style.left).toBe("170px");
    expect(b2?.style.width).toBe("60px");
    expect(b2).toHaveAttribute("data-lit");
    expect(document.querySelector('[data-station="b-4"]')).not.toHaveAttribute(
      "data-lit",
    );
    expect(
      document.querySelector<HTMLElement>("[data-scene-pip]")?.hidden,
    ).toBe(true);
  });

  test("focus on a Lesson link by any means moves Pip to its Station, and the arrow keys move focus and Pip along", async () => {
    const { path } = await onPath();
    act(() => {
      link("b-3")?.focus();
    });
    expect(path.at()).toBe("b-3");
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowRight" });
    expect(document.activeElement).toBe(link("b-4"));
    expect(path.at()).toBe("b-4");
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowUp" });
    expect(document.activeElement).toBe(link("b-3"));
    expect(path.at()).toBe("b-3");
    // Tab is never captured.
    const tab = fireEvent.keyDown(document.activeElement as Element, {
      key: "Tab",
    });
    expect(tab).toBe(true);
  });

  test("a swipe or a drag sideways moves Pip one Station along, and focus with it", async () => {
    const { path } = await onPath();
    const band = stage() as HTMLElement;
    press(band, [{ id: 1, x: 400, y: 300 }], "pointerDown");
    press(band, [{ id: 1, x: 330, y: 305 }], "pointerUp");
    expect(path.at()).toBe("b-2");
    expect(document.activeElement).toBe(link("b-2"));
    press(band, [{ id: 2, x: 300, y: 300 }], "pointerDown");
    press(band, [{ id: 2, x: 380, y: 300 }], "pointerUp");
    expect(path.at()).toBe("b-1");
    // Up and down is the page's scroll: Pip stays.
    press(band, [{ id: 3, x: 300, y: 300 }], "pointerDown");
    press(band, [{ id: 3, x: 300, y: 380 }], "pointerUp");
    expect(path.at()).toBe("b-1");
  });

  test("a tap on a Station opens what its link opens, an offer included", async () => {
    const { page } = await onPath();
    page.access.set({ "b-1": { open: false, offer: "keep-going" } });
    const band = stage() as HTMLElement;
    press(band, [{ id: 1, x: 105, y: 195 }], "pointerDown");
    press(band, [{ id: 1, x: 105, y: 195 }], "pointerUp");
    await waitFor(() => {
      expect(window.location.pathname).toBe("/lesson/b-1/");
    });
    expect(await screen.findByText("Offer keep-going for b-1")).toBeVisible();
  });

  test("a tap away from every Station opens nothing", async () => {
    await onPath();
    const band = stage() as HTMLElement;
    press(band, [{ id: 1, x: 150, y: 400 }], "pointerDown");
    press(band, [{ id: 1, x: 150, y: 400 }], "pointerUp");
    expect(window.location.pathname).toBe("/journey/");
  });

  test("a pinch, a scroll and the control pull back to the whole Level and go back in", async () => {
    const { path } = await onPath();
    const band = stage() as HTMLElement;
    const control = screen.getByRole("button", { name: WHOLE_LEVEL });

    press(
      band,
      [
        { id: 1, x: 200, y: 300 },
        { id: 2, x: 400, y: 300 },
      ],
      "pointerDown",
    );
    press(band, [{ id: 2, x: 300, y: 300 }], "pointerMove");
    expect(path.whole()).toBe(true);
    await waitFor(() => {
      expect(control).toHaveAttribute("aria-pressed", "true");
    });
    press(band, [{ id: 2, x: 500, y: 300 }], "pointerMove");
    expect(path.whole()).toBe(false);
    press(
      band,
      [
        { id: 1, x: 200, y: 300 },
        { id: 2, x: 500, y: 300 },
      ],
      "pointerUp",
    );
    // The pinch's fingers lifting open nothing.
    expect(window.location.pathname).toBe("/journey/");

    expect(fireEvent.wheel(band, { deltaY: 100 })).toBe(false);
    expect(path.whole()).toBe(true);
    // Pulled back already, a scroll down scrolls the page.
    expect(fireEvent.wheel(band, { deltaY: 100 })).toBe(true);
    fireEvent.wheel(band, { deltaY: -100 });
    expect(path.whole()).toBe(false);

    fireEvent.click(control);
    expect(path.whole()).toBe(true);
    fireEvent.click(control);
    expect(path.whole()).toBe(false);
  });

  test("the other Levels keep today's screen: no band, and the screen's own Pip", async () => {
    await onPath();
    fireEvent.click(screen.getByRole("tab", { name: /Intermediate/ }));
    await waitFor(() => {
      expect(stage()).toBeNull();
    });
    expect(document.querySelector("[data-pip-stood-down]")).toBeNull();
    expect(document.querySelector('[data-pip="beside"]')).not.toBeNull();
  });

  test("the Stations are the snapshot's Lessons, lit from complete alone, the same until one changes", async () => {
    const { heard, page } = await onPath();
    const told = heard.props.at(-1)?.stations ?? [];
    expect(told.filter((s) => s.level === "beginner")).toEqual(
      BEGINNER.map((lesson, i) => ({
        lesson,
        level: "beginner",
        complete: i < 3,
      })),
    );
    expect(told).toHaveLength(23);
    page.send(snapshotOf(overview, { course: fullCourse, revision: 2 }));
    await waitFor(() => {
      expect(heard.props.at(-1)?.stations).toBe(told);
    });
    const done = structuredClone(fullCourse);
    const b4 = done.levels[0]?.lessons[3];
    if (b4) b4.complete = true;
    page.send(snapshotOf(overview, { course: done, revision: 3 }));
    await waitFor(() => {
      expect(
        heard.props.at(-1)?.stations.find((s) => s.lesson === "b-4")?.complete,
      ).toBe(true);
    });
  });
});

describe("the Journey with the Scene off (the Local app)", () => {
  test("has no band, keeps the screen's Pip, and leaves the arrow keys alone", async () => {
    renderMounted("/journey/", snapshotOf(overview, { course: fullCourse }));
    await screen.findByRole("heading", { level: 1 });
    expect(stage()).toBeNull();
    expect(document.querySelector("[data-pip-stood-down]")).toBeNull();
    act(() => {
      link("b-2")?.focus();
    });
    const key = fireEvent.keyDown(document.activeElement as Element, {
      key: "ArrowRight",
    });
    expect(key).toBe(true);
    expect(document.activeElement).toBe(link("b-2"));
  });
});
