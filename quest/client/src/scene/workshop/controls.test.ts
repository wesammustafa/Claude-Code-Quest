// The workshop's page parts decide what Pip's live line says, how Explore
// steers him, and what a tap on the room does, before any is drawn.
import { describe, expect, test } from "vitest";
import type { StationPoint } from "../path";
import {
  activityLine,
  dropNextClick,
  keysSteer,
  roomTap,
  stickSteer,
  tapsRoom,
} from "./controls";
import type { PipStatus } from "./store";

const at = (
  activity: PipStatus["activity"],
  spot: PipStatus["at"] = null,
): PipStatus => ({ activity, at: spot });

describe("the live line", () => {
  test("says when Pip sets off, arrives, sleeps and wakes", () => {
    expect(activityLine(at("idle"), at("walking"))).toBe("Pip is walking");
    expect(activityLine(at("walking"), at("running"))).toBe("Pip is running");
    expect(activityLine(at("running"), at("idle", "noticeboard"))).toBe(
      "Pip is at the noticeboard",
    );
    expect(activityLine(at("idle"), at("asleep"))).toBe("Pip is asleep");
    expect(activityLine(at("asleep"), at("idle"))).toBe("Pip is awake");
  });

  test("says nothing when nothing worth saying changed", () => {
    expect(activityLine(at("walking"), at("walking"))).toBeNull();
    expect(activityLine(at("greeting"), at("idle"))).toBeNull();
    // His bubble says hello; the live line does not say it again.
    expect(activityLine(at("idle"), at("greeting"))).toBeNull();
  });
});

describe("Explore's steering", () => {
  test("the keys held steer him at full length, the room's way, and run with Shift", () => {
    expect(keysSteer(new Set(["ArrowUp"]), false)).toEqual({
      x: 0,
      z: -1,
      run: false,
    });
    const diagonal = keysSteer(new Set(["KeyD", "ArrowDown"]), true);
    expect(diagonal.run).toBe(true);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 9);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.z).toBeGreaterThan(0);
  });

  test("no steering key, or two that cancel, stops him", () => {
    expect(keysSteer(new Set(["Tab", "KeyQ"]), true)).toEqual({
      x: 0,
      z: 0,
      run: false,
    });
    expect(keysSteer(new Set(["ArrowLeft", "ArrowRight"]), false)).toEqual({
      x: 0,
      z: 0,
      run: false,
    });
  });

  test("the stick walks him as far as it is pushed, and runs him past its ring", () => {
    expect(stickSteer(20, 0, 40)).toEqual({ x: 0.5, z: 0, run: false });
    expect(stickSteer(0, 60, 40)).toEqual({ x: 0, z: 1, run: true });
    expect(stickSteer(0, 0, 40)).toEqual({ x: 0, z: 0, run: false });
  });
});

describe("a tap on the room", () => {
  const cards: StationPoint[] = [
    { lesson: "b-1", x: 100, y: 100, r: 30, lit: true },
    { lesson: "b-2", x: 150, y: 100, r: 30, lit: false },
  ];

  test("on Pip greets him", () => {
    expect(roomTap({ kind: "pip" }, cards, 100, 100)).toEqual({
      type: "greet",
    });
  });

  test("on a card opens its Lesson, the nearest of two that reach", () => {
    const place = { kind: "place", place: "noticeboard" } as const;
    expect(roomTap(place, cards, 140, 100)).toEqual({
      type: "open",
      lesson: "b-2",
    });
  });

  test("on the floor or a place away from its cards walks him there; on nothing does nothing", () => {
    const floor = { kind: "floor", x: 1, z: 2 } as const;
    expect(roomTap(floor, cards, 400, 400)).toEqual({
      type: "walk",
      to: floor,
    });
    expect(roomTap(null, cards, 100, 100)).toBeNull();
  });

  test("passes through the page's frame and its spacers, never a control or a surface", () => {
    const room = document.createElement("main");
    room.setAttribute("data-room", "");
    const card = document.createElement("section");
    const button = document.createElement("button");
    card.append(button);
    room.append(card);
    expect(tapsRoom(room)).toBe(true);
    expect(tapsRoom(card)).toBe(false);
    expect(tapsRoom(button)).toBe(false);
    expect(tapsRoom(null)).toBe(false);
  });
});

describe("a tap that opens another screen", () => {
  const press = (button: HTMLElement) =>
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }),
    );
  const counted = () => {
    const button = document.createElement("button");
    const presses = { n: 0 };
    button.addEventListener("click", () => {
      presses.n += 1;
    });
    document.body.append(button);
    return { button, presses };
  };

  test("drops the pointer's click that follows it, so it never presses the new screen's control", () => {
    const { button, presses } = counted();
    dropNextClick();
    press(button);
    expect(presses.n).toBe(0);
    press(button);
    expect(presses.n).toBe(1);
    button.remove();
  });

  test("lets a key's click through, and the next press's click when the tap sent none", () => {
    const { button, presses } = counted();
    dropNextClick();
    button.click();
    expect(presses.n).toBe(1);
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    press(button);
    expect(presses.n).toBe(2);
    button.remove();
  });
});
