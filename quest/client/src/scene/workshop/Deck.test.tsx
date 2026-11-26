// The workshop's parts on the page (the warm workshop, D8), on the mounted
// client with the Scene on: Welcome over the room keeps its host, and the
// renderer, a stand-in that draws the workshop's anchors, cards and pick
// where the test says, draws the deck there. A tap on Pip greets him, a
// tap on the floor walks him, a tap on a card opens its Lesson, a tap on
// the page's own controls stays theirs; the tags link to each place's
// Lesson; Explore steers him only while it is on and never takes Tab; the
// still tier draws none of it. jsdom has no WebGL.
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useContext, useEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { CourseView } from "@quest/contract";
import {
  fullCourse,
  overview,
  overviewAt,
  snapshotOf,
} from "../../../e2e/snapshots";
import { renderMounted } from "../../../test/mounted";
import { drawingTier, LOOK } from "../../../test/scene";
import type { SceneMount, SceneProps } from "../../mount/types";
import { SceneContext } from "../context";
import { journeyPathOf } from "../path";
import { resetTierProbes } from "../tier";
import { DeckPortal } from "./Deck";
import { workshopOf, type PipCommand, type WorkshopPick } from "./store";

interface Drawn {
  commands: PipCommand[];
  pick: WorkshopPick;
  loads: number;
}

/** A renderer that draws the workshop's anchors and one card, picks what the test says, and hears Pip's commands. */
function sceneWith(drawn: Drawn): SceneMount {
  function StandIn({ pip = false, stations }: SceneProps): ReactNode {
    const hub = useContext(SceneContext);
    useEffect(() => {
      const workshop = workshopOf(hub);
      const offCommands = workshop.onCommand((c) => drawn.commands.push(c));
      const offPick = workshop.setPick(() => drawn.pick);
      workshop.setAnchors({
        noticeboard: { x: 300, y: 300, visible: true },
        organizer: { x: 700, y: 300, visible: true },
        pip: { x: 500, y: 500, visible: true },
      });
      journeyPathOf(hub).setView({
        points: [{ lesson: "b-2", x: 300, y: 200, r: 30, lit: true }],
        pip: null,
      });
      workshop.setReady(true);
      return () => {
        offCommands();
        offPick();
        workshop.setReady(false);
      };
    }, [hub]);
    return <DeckPortal pip={pip} stations={stations} />;
  }
  return {
    load: () => {
      drawn.loads += 1;
      return Promise.resolve({ default: StandIn });
    },
    look: LOOK,
    pip: true,
  };
}

/** Welcome over the room, with the deck drawn: a returning Learner (b-1 to b-3 done) unless `course` says. */
async function onWelcome(course: CourseView = fullCourse) {
  const drawn: Drawn = { commands: [], pick: null, loads: 0 };
  renderMounted("/", snapshotOf(overviewAt("b-4"), { course }), {
    scene: sceneWith(drawn),
  });
  await screen.findByRole("toolbar", { name: "Pip" });
  return drawn;
}

const room = () => document.querySelector<HTMLElement>("main[data-room]");

/** A tap at (x, y) on `el`: pressed and let go in place. */
function tap(el: Element, x: number, y: number) {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
  fireEvent.pointerUp(el, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
  });
}

const key = (code: string, type: "keyDown" | "keyUp" = "keyDown") =>
  fireEvent[type](document.body, { key: code, code });

beforeEach(drawingTier);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("taps on the room", () => {
  test("a tap on Pip greets him, and his bubble says hello", async () => {
    const drawn = await onWelcome();
    drawn.pick = { kind: "pip" };
    tap(room() as HTMLElement, 500, 520);
    expect(drawn.commands).toEqual([{ type: "greet" }]);
    expect(
      within(
        document.querySelector(
          "[data-pip-bubble] [role=status]",
        ) as HTMLElement,
      ).getByText("Hello!"),
    ).toBeInTheDocument();
  });

  test("a tap on the floor walks him there; a tap on the welcome card or a button is the page's", async () => {
    const drawn = await onWelcome();
    drawn.pick = { kind: "floor", x: 1.5, z: -2 };
    tap(room() as HTMLElement, 600, 600);
    expect(drawn.commands).toEqual([
      { type: "goTo", to: { floor: { x: 1.5, z: -2 } } },
    ]);
    const card = document.querySelector("[data-welcome-card]") as HTMLElement;
    tap(card, 100, 100);
    tap(within(card).getByRole("button", { name: "Say hello" }), 100, 100);
    // The button's own click greets; no tap reached the room.
    expect(drawn.commands).toHaveLength(1);
  });

  test("a tap on a card opens that Lesson's overview", async () => {
    const drawn = await onWelcome();
    drawn.pick = { kind: "place", place: "noticeboard" };
    tap(room() as HTMLElement, 305, 205);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/lesson/b-2/");
    });
    expect(drawn.commands).toEqual([]);
  });
});

describe("the place tags", () => {
  test("each links to its place's next Lesson, the course's next marked", async () => {
    await onWelcome();
    const board = document.querySelector("a[data-place-tag=noticeboard]");
    expect(board?.getAttribute("href")).toBe("/lesson/b-4/");
    expect(board?.hasAttribute("data-next")).toBe(true);
    const kit = document.querySelector("a[data-place-tag=organizer]");
    expect(kit?.getAttribute("href")).toBe("/lesson/i-1/");
    expect(kit?.hasAttribute("data-next")).toBe(false);
    // A place the renderer does not draw in view keeps its tag out of reach.
    expect(
      document
        .querySelector("a[data-place-tag=release-desk]")
        ?.closest("[data-anchored]")
        ?.getAttribute("data-anchored"),
    ).toBe("hidden");
  });

  test("a complete Level's tag says so and opens its last core Lesson, where the Learner's work is", async () => {
    const done: CourseView = {
      ...fullCourse,
      levels: fullCourse.levels.map((level) =>
        level.id === "beginner"
          ? {
              ...level,
              complete: true,
              lessons: level.lessons.map((l) => ({ ...l, complete: true })),
            }
          : level,
      ),
      next: "i-1",
    };
    await onWelcome(done);
    const board = document.querySelector("a[data-place-tag=noticeboard]");
    expect(board?.getAttribute("href")).toBe("/lesson/b-capstone/");
    expect(board?.hasAttribute("data-done")).toBe(true);
    expect(board?.textContent).toContain("Beginner · complete");
  });
});

describe("Pip's toolbar", () => {
  test("Send Pip to lists the room's spots; one sends him, and Esc closes the list with focus back on its button", async () => {
    const drawn = await onWelcome();
    const send = screen.getByRole("button", { name: "Send Pip to" });
    fireEvent.click(send);
    expect(send).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /^Workbench/ }));
    expect(drawn.commands).toEqual([{ type: "goTo", to: { spot: "bench" } }]);
    fireEvent.click(send);
    key("Escape");
    expect(send).toHaveAttribute("aria-expanded", "false");
    expect(send).toHaveFocus();
  });

  test("What's next walks him to the next Lesson's place and says its title", async () => {
    const drawn = await onWelcome();
    fireEvent.click(screen.getByRole("button", { name: "What's next" }));
    expect(drawn.commands).toEqual([
      { type: "goTo", to: { spot: "noticeboard" } },
    ]);
    expect(
      document.querySelector("[data-pip-bubble] [role=status]")?.textContent,
    ).toMatch(/^Next: /);
  });
});

describe("Explore", () => {
  test("the steering keys move Pip only while it is on, Tab is never taken, and Esc leaves with focus back on its button", async () => {
    const drawn = await onWelcome();
    // Off: an arrow is the page's.
    expect(key("ArrowUp")).toBe(true);
    key("ArrowUp", "keyUp");
    expect(drawn.commands).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Explore with Pip" }));
    expect(drawn.commands).toEqual([{ type: "explore", on: true }]);
    expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
    expect(
      screen.getByRole("application", { name: /^Steer Pip/ }),
    ).toBeInTheDocument();
    expect(key("ArrowUp")).toBe(false);
    expect(drawn.commands.at(-1)).toEqual({
      type: "steer",
      x: 0,
      z: -1,
      run: false,
    });
    expect(key("Tab")).toBe(true);
    key("ArrowUp", "keyUp");
    expect(drawn.commands.at(-1)).toEqual({
      type: "steer",
      x: 0,
      z: 0,
      run: false,
    });

    key("Escape");
    expect(drawn.commands.at(-1)).toEqual({ type: "explore", on: false });
    expect(
      screen.getByRole("button", { name: "Explore with Pip" }),
    ).toHaveFocus();
    const heard = drawn.commands.length;
    expect(key("ArrowUp")).toBe(true);
    expect(drawn.commands).toHaveLength(heard);
  });

  test("a key typed into a field is the field's", async () => {
    const drawn = await onWelcome();
    fireEvent.click(screen.getByRole("button", { name: "Explore with Pip" }));
    const field = document.createElement("input");
    document.body.append(field);
    expect(fireEvent.keyDown(field, { key: "ArrowUp", code: "ArrowUp" })).toBe(
      true,
    );
    expect(drawn.commands).toEqual([{ type: "explore", on: true }]);
    field.remove();
  });
});

test("the still tier draws no deck: no Explore, no toolbar, no taps on the room, and Welcome's own card still works", async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetTierProbes();
  const drawn: Drawn = { commands: [], pick: { kind: "pip" }, loads: 0 };
  renderMounted("/", snapshotOf(overview), { scene: sceneWith(drawn) });
  expect(
    await screen.findByRole("button", { name: "Start the first lesson" }),
  ).toBeInTheDocument();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  tap(room() as HTMLElement, 500, 520);
  expect(drawn.loads).toBe(0);
  expect(drawn.commands).toEqual([]);
  expect(screen.queryByRole("toolbar", { name: "Pip" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Explore with Pip" })).toBeNull();
  expect(screen.getByRole("button", { name: "Say hello" })).toBeVisible();
});
