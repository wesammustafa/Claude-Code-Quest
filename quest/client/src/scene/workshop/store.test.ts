// The workshop's shared state (D8): where the renderer drew its anchors,
// what lies under a point, Pip's commands and his status, one per page's
// Scene, with no 3D code.
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { SceneContext, createSceneHub } from "../context";
import {
  createWorkshop,
  useWorkshop,
  workshopOf,
  type PipCommand,
} from "./store";

describe("the workshop's state", () => {
  test("tells its listeners of anchors that moved by half a pixel or more, came, went or changed view", () => {
    const workshop = createWorkshop();
    const drawn = vi.fn();
    workshop.subscribeAnchors(drawn);
    const at = { x: 100, y: 50, visible: true };
    workshop.setAnchors({ pip: at });
    expect(drawn).toHaveBeenCalledTimes(1);
    // Two small moves: the second is measured from the anchors last told.
    workshop.setAnchors({ pip: { ...at, x: 100.3 } });
    workshop.setAnchors({ pip: { ...at, x: 100.4, y: 50.4 } });
    expect(drawn).toHaveBeenCalledTimes(1);
    expect(workshop.anchors().pip).toEqual(at);
    workshop.setAnchors({ pip: { ...at, x: 100.5 } });
    workshop.setAnchors({ pip: { ...at, x: 100.5, visible: false } });
    workshop.setAnchors({
      pip: { ...at, x: 100.5, visible: false },
      "card:b-1": at,
    });
    workshop.setAnchors({ "card:b-1": at });
    expect(drawn).toHaveBeenCalledTimes(5);
    expect(workshop.anchors()).toEqual({ "card:b-1": at });
  });

  test("holds the probe set to measure Pip's motion until it is cleared", () => {
    const workshop = createWorkshop();
    expect(workshop.probe?.()).toBeNull();
    const probe = vi.fn();
    workshop.setProbe?.(probe);
    expect(workshop.probe?.()).toBe(probe);
    workshop.setProbe?.(null);
    expect(workshop.probe?.()).toBeNull();
  });

  test("picks nothing until a renderer registers its pick, and nothing once it lets go", () => {
    const workshop = createWorkshop();
    expect(workshop.pick(10, 20)).toBeNull();
    const first = workshop.setPick(() => ({ kind: "pip" }));
    const release = workshop.setPick((x, y) => ({ kind: "floor", x, z: y }));
    // The first renderer's late release leaves the second's pick in place.
    first();
    expect(workshop.pick(10, 20)).toEqual({ kind: "floor", x: 10, z: 20 });
    release();
    expect(workshop.pick(10, 20)).toBeNull();
  });

  test("hands each command to the renderer while it listens, drops it when none does, and tells only of a new status", () => {
    const workshop = createWorkshop();
    const go: PipCommand = { type: "goTo", to: { place: "noticeboard" } };
    workshop.send(go);
    const heard = vi.fn();
    const stop = workshop.onCommand(heard);
    workshop.send(go);
    stop();
    workshop.send({ type: "greet" });
    expect(heard.mock.calls).toEqual([[go]]);

    const told = vi.fn();
    workshop.subscribeStatus(told);
    expect(workshop.status()).toEqual({ activity: "idle", at: null });
    workshop.setStatus({ activity: "idle", at: null });
    workshop.setStatus({ activity: "walking", at: null });
    workshop.setStatus({ activity: "walking", at: null });
    workshop.setStatus({ activity: "idle", at: "noticeboard" });
    expect(told).toHaveBeenCalledTimes(2);

    const readied = vi.fn();
    workshop.subscribeReady(readied);
    workshop.setReady(false);
    workshop.setReady(true);
    workshop.setReady(true);
    expect(workshop.ready()).toBe(true);
    expect(readied).toHaveBeenCalledTimes(1);
  });

  test("is one per page's Scene, the one around the caller", () => {
    const hub = createSceneHub();
    expect(workshopOf(hub)).toBe(workshopOf(hub));
    expect(workshopOf(createSceneHub())).not.toBe(workshopOf(hub));
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SceneContext, { value: hub }, children);
    const { result } = renderHook(() => useWorkshop(), { wrapper });
    expect(result.current).toBe(workshopOf(hub));
  });
});
