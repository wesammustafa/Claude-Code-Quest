import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { QuestAction } from "@quest/contract";
import { playing, snapshotOf } from "../e2e/snapshots";
import { FakeEventSource, fakeFetch } from "../test/live";
import {
  fakeLive,
  held,
  renderMounted,
  stubPageGlobals,
} from "../test/mounted";
import type { ClientMount } from "./mount/types";

const step = snapshotOf(playing);

function topBar(): HTMLElement {
  const header = document.querySelector<HTMLElement>("[data-top] header");
  if (header === null) throw new Error("no top bar");
  return header;
}

describe("the client mount", () => {
  test("the default mount renders the Local app on the hash router with no slot", async () => {
    FakeEventSource.reset();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fakeFetch(() => ({ status: 200, body: {} })).fetch);
    const root = document.createElement("div");
    root.id = "root";
    document.body.append(root);
    window.history.replaceState(null, "", "/#/journey");
    // main.tsx, through a mountQuest that keeps what it was given.
    const given: ClientMount[] = [];
    let stop: () => void = () => undefined;
    vi.resetModules();
    vi.doMock("./mount", async (original) => {
      const mount = await original<typeof import("./mount")>();
      return {
        ...mount,
        mountQuest: (at: HTMLElement, options: ClientMount) => {
          given.push(options);
          stop = mount.mountQuest(at, options);
          return stop;
        },
      };
    });
    try {
      await act(async () => {
        await import("./main");
      });
      expect(given).toHaveLength(1);
      expect(Object.keys(given[0] ?? {})).toEqual(["live"]);
      expect(FakeEventSource.last.url).toBe("/api/events");
      act(() => {
        FakeEventSource.last.emit("snapshot", step);
      });
      await screen.findByRole("heading", { level: 1 });
      expect(window.location.hash).toBe("#/journey");
      const header = topBar();
      expect(header).toHaveTextContent("Claude Code Quest");
      // Nothing a slot would add.
      expect(document.querySelector("[data-practice-pane]")).toBeNull();
      expect(document.querySelector("[data-mount-notices]")).toBeNull();
      const main = within(header).getByRole("navigation", { name: "Main" });
      expect(main.lastElementChild).toHaveAccessibleName("Settings");
    } finally {
      act(() => {
        stop();
      });
      root.remove();
      vi.doUnmock("./mount");
      vi.unstubAllGlobals();
      window.history.replaceState(null, "", "/");
    }
  });

  test("the mount's live is the only transport: EventSource and fetch come from mount.live and the page's globals are never called", async () => {
    const mounted = renderMounted("/lesson/b-1/step/", step, { slots: {} });
    expect(FakeEventSource.last.url).toBe("/api/events");
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => {
      expect(mounted.posts.map((p) => p.action.type)).toEqual(["check.run"]);
    });
    expect(vi.mocked(globalThis.EventSource)).not.toHaveBeenCalled();
    // The page's fetch throws for the API: it was never asked for it.
    const pageFetch = vi.mocked(globalThis.fetch);
    expect(pageFetch.mock.results.filter((r) => r.type === "throw")).toEqual(
      [],
    );
    expect(mounted.fetched.every((url) => url.startsWith("/api/"))).toBe(true);
  });

  test("actions carry the LiveDeps actionId", async () => {
    const mounted = renderMounted("/lesson/b-1/step/", step, { slots: {} });
    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => {
      expect(mounted.posts).toEqual([
        { action: { type: "check.run", beat: "b-1:C:0" }, id: "id-1" },
      ]);
    });
  });

  test("routes on the hash router are refused", async () => {
    const { mountQuest } = await import("./mount");
    stubPageGlobals();
    const root = document.createElement("div");
    const record = { posts: [], fetched: [] };
    const live = fakeLive(record, () => null);
    expect(() => mountQuest(root, { live, routes: [] })).toThrow(
      "Added routes need the browser router",
    );
    expect(() =>
      mountQuest(root, { live, router: "hash", routes: [{ path: "x" }] }),
    ).toThrow();
    vi.unstubAllGlobals();
  });

  test("the returned unmount closes the stream", () => {
    const mounted = renderMounted("/journey/", step, { slots: {} });
    const stream = FakeEventSource.last;
    expect(stream.closed).toBe(false);
    mounted.unmount();
    expect(stream.closed).toBe(true);
    expect(document.querySelector("[data-screen]")).toBeNull();
  });

  test("actionsOff turns actions off while it says so", async () => {
    const off = held(true);
    stubPageGlobals();
    const { mountQuest } = await import("./mount");
    FakeEventSource.reset();
    window.history.replaceState(null, "", "/lesson/b-1/step/");
    const record = {
      posts: [] as { action: QuestAction; id?: string }[],
      fetched: [] as string[],
    };
    const live = fakeLive(record, () => step, { actionsOff: off });
    const root = document.createElement("div");
    document.body.append(root);
    let stop: () => void = () => undefined;
    act(() => {
      stop = mountQuest(root, { live, router: "browser" });
    });
    try {
      act(() => {
        FakeEventSource.last.emit("snapshot", step);
      });
      const check = await screen.findByRole("button", { name: "Check again" });
      expect(check).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(check);
      expect(record.posts).toEqual([]);

      off.set(false);
      expect(check).not.toHaveAttribute("aria-disabled");
      await userEvent.click(check);
      await waitFor(() => {
        expect(record.posts).toHaveLength(1);
      });

      off.set(true);
      expect(check).toHaveAttribute("aria-disabled", "true");
    } finally {
      act(() => {
        stop();
      });
      root.remove();
      vi.unstubAllGlobals();
    }
  });
  test("calling the returned unmount again does nothing", async () => {
    const { mountQuest } = await import("./mount");
    stubPageGlobals();
    FakeEventSource.reset();
    window.history.replaceState(null, "", "/#/journey");
    const root = document.createElement("div");
    document.body.append(root);
    const live = fakeLive({ posts: [], fetched: [] }, () => step);
    let stop: () => void = () => undefined;
    act(() => {
      stop = mountQuest(root, { live });
    });
    act(() => {
      stop();
    });
    expect(() => {
      act(() => {
        stop();
      });
    }).not.toThrow();
    expect(root).toBeEmptyDOMElement();
    root.remove();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  test("on the hash router a built-in screen's frame follows its exact path: #/journey/ is not the journey", async () => {
    const { mountQuest } = await import("./mount");
    const gazeAt = (hash: string): string => {
      stubPageGlobals();
      FakeEventSource.reset();
      window.history.replaceState(null, "", `/${hash}`);
      const root = document.createElement("div");
      document.body.append(root);
      const live = fakeLive({ posts: [], fetched: [] }, () => step);
      let stop: () => void = () => undefined;
      act(() => {
        stop = mountQuest(root, { live });
      });
      act(() => {
        FakeEventSource.last.emit("snapshot", step);
      });
      const gaze =
        root.querySelector("[data-pip-gaze]")?.getAttribute("data-pip-gaze") ??
        "none";
      act(() => {
        stop();
      });
      root.remove();
      vi.unstubAllGlobals();
      return gaze;
    };
    const journey = gazeAt("#/journey");
    const other = gazeAt("#/nope");
    expect(journey).not.toBe(other);
    expect(gazeAt("#/journey/")).toBe(other);
    expect(gazeAt("#/Journey")).toBe(other);
    window.history.replaceState(null, "", "/");
  });
});
