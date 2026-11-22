// The client as another page mounts it, for the mount's tests: mountQuest
// on in-page fake LiveDeps (a FakeEventSource and a recording fetch), the
// browser router at a path set with history.replaceState, and every slot
// set, each to a small part the test can find and drive.
import { act } from "@testing-library/react";
import type { RouteObject } from "react-router";
import { onTestFinished, vi } from "vitest";
import type { QuestAction, Snapshot } from "@quest/contract";
import { createShownEvents } from "../src/live/events";
import type { LiveDeps } from "../src/live/store";
import { mountQuest } from "../src/mount";
import type {
  ClientMount,
  ClientSlots,
  InsertRequest,
  InsertResult,
  LessonAccess,
  Notice,
  ScreenTransitions,
} from "../src/mount/types";
import { resetPageCache } from "../src/pages/fetch";
import { FakeEventSource } from "./live";

/** A value the page holds, which the test changes. */
export interface Held<T> {
  get(): T;
  subscribe(fn: () => void): () => void;
  set(value: T): void;
}

export function held<T>(value: T): Held<T> {
  let now = value;
  const listeners = new Set<() => void>();
  return {
    get: () => now,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    set(next) {
      now = next;
      act(() => {
        for (const fn of listeners) fn();
      });
    },
  };
}

export interface Mounted {
  /** Every action POSTed, oldest first, with its request id. */
  posts: { action: QuestAction; id?: string }[];
  /** Every URL fetched, oldest first. */
  fetched: string[];
  /** Sends a snapshot on the stream. */
  send: (snapshot: Snapshot) => void;
  /** The unmount mountQuest returned (run at the test's end if not before). */
  unmount: () => void;
  /** Every call the slots heard, in order: `name:args` (Next adds the posts made before it). */
  heard: string[];
  inserts: InsertRequest[];
  insertResult: { next: InsertResult };
  access: Held<Record<string, LessonAccess>>;
  notices: Held<readonly Notice[]>;
  checkWaiting: Held<string | null>;
}

const LABELS = {
  terminal: "Terminal",
  claude: "Terminal · claude",
  "claude-2": "Terminal 2 · claude",
  shell: "Terminal · shell",
  editor: "Terminal · files",
  browser: "Terminal · browser",
} as const;

/** Pages the page's own fetch serves: the static page index, which Settings reads. */
export const pageGets: string[] = [];

/**
 * The page's own globals are never the mount's transport: its EventSource
 * throws, and its fetch throws for the API, serving only the static pages.
 */
export function stubPageGlobals(): void {
  pageGets.length = 0;
  vi.stubGlobal(
    "EventSource",
    vi.fn(() => {
      throw new Error("the page's EventSource was used");
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.startsWith("/api/"))
        throw new Error("the page's fetch was used for the API");
      pageGets.push(url);
      return Promise.resolve(
        url === "/pages/index.json"
          ? Response.json({ ref: "v0000.00", pages: [] })
          : new Response("", { status: 404 }),
      );
    }),
  );
}

/** The in-page transport: the fake stream, a recording fetch, real timers. */
export function fakeLive(
  record: { posts: Mounted["posts"]; fetched: string[] },
  shown: () => Snapshot | null,
  extra: Partial<LiveDeps> = {},
): LiveDeps {
  return {
    EventSource: FakeEventSource,
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    hidden: () => false,
    onVisibility: () => () => undefined,
    now: () => Date.now(),
    shown: () => createShownEvents(null),
    fetch: (url, init) => {
      record.fetched.push(url);
      if (url === "/api/health")
        return Promise.resolve(Response.json({ ok: true, instance: "e2e" }));
      const body = JSON.parse(init?.body as string) as {
        action: QuestAction;
        id?: string;
      };
      record.posts.push(
        body.id === undefined
          ? { action: body.action }
          : { action: body.action, id: body.id },
      );
      const reply = shown();
      return Promise.resolve(
        Response.json({ revision: reply?.revision, snapshot: reply }),
      );
    },
    ...extra,
  };
}

/**
 * Mounts the client at `path` on the browser router with every slot set
 * (or `slots` in their place), connected with `snapshot` (unless null),
 * with screen transitions when `transitions` is given.
 */
export function renderMounted(
  path: string,
  snapshot: Snapshot | null,
  {
    routes,
    slots: own,
    transitions,
  }: {
    routes?: RouteObject[];
    slots?: ClientSlots;
    transitions?: ScreenTransitions;
  } = {},
): Mounted {
  FakeEventSource.reset();
  resetPageCache();
  stubPageGlobals();
  window.history.replaceState(null, "", path);
  const record = { posts: [] as Mounted["posts"], fetched: [] as string[] };
  const heard: string[] = [];
  const inserts: InsertRequest[] = [];
  const insertResult: { next: InsertResult } = { next: "inserted" };
  const access = held<Record<string, LessonAccess>>({});
  const notices = held<readonly Notice[]>([]);
  const checkWaiting = held<string | null>(null);
  const slots: ClientSlots = own ?? {
    practicePane: ({ beat, onInput }) => (
      <div data-test-pane="">
        {`${beat.lesson} ${beat.step} ${String(beat.beat)} ${beat.where ?? "none"} ${String(beat.terminal)}`}
        <button type="button" onClick={onInput}>
          Send input
        </button>
      </div>
    ),
    command: {
      action: "insert",
      insert: (req) => {
        inserts.push(req);
        heard.push(`insert:${req.text}`);
        return insertResult.next;
      },
    },
    where: {
      labels: LABELS,
      focus: (kind, terminal) => {
        heard.push(`focus:${kind}:${String(terminal)}`);
      },
    },
    stepActionsStart: () => (
      <button type="button" data-test-reset="">
        Reset step
      </button>
    ),
    settingsSections: [
      () => <section data-test-settings="a">Account</section>,
      () => <section data-test-settings="b">Storage</section>,
    ],
    settingsHide: ["work-folders", "release", "codespace"],
    topBarEnd: () => (
      <button type="button" data-test-sign-in="">
        Sign in
      </button>
    ),
    lessonCompleteExtra: ({ lesson }) => (
      <p data-test-lesson-extra="">{`Extra for ${lesson}`}</p>
    ),
    courseCompleteExtra: () => <p data-test-course-extra="">Course extra</p>,
    lessonAccess: {
      get: (lesson) => access.get()[lesson] ?? { open: true },
      subscribe: (fn) => access.subscribe(fn),
      Offer: ({ lesson, offer }) => (
        <p data-test-offer={offer}>{`Offer ${offer} for ${lesson}`}</p>
      ),
    },
    copy: {
      productName: "Test Product",
      waitingLine: "Getting your Lesson ready…",
      welcomeLine: "The Lesson is on one side.",
    },
    brand: {
      mark: () => <span data-test-mark="" />,
      title: "Test Product",
    },
    notices,
    checkLinesExtra: ({ beat, pass }) => (
      <p data-test-lines-extra="">{`${beat} ${pass ? "pass" : "miss"}`}</p>
    ),
    // Empty, so a line's words read as without it: its props, as JSON.
    checkLine: (props) => <span data-test-check-line={JSON.stringify(props)} />,
    checkWaiting,
    // With the number of actions posted so far, to show it runs first.
    onStepNext: (step) => {
      heard.push(`next:${step}:${String(record.posts.length)}`);
    },
  };

  let shown = snapshot;
  const mount: ClientMount = {
    live: fakeLive(record, () => shown, { actionId: () => "id-1" }),
    router: "browser",
    slots,
    ...(routes ? { routes } : {}),
    ...(transitions ? { transitions } : {}),
  };
  const root = document.createElement("div");
  document.body.append(root);
  let unmounted = false;
  let stop: () => void = () => undefined;
  act(() => {
    stop = mountQuest(root, mount);
  });
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    act(() => {
      stop();
    });
    root.remove();
  };
  onTestFinished(() => {
    unmount();
    vi.unstubAllGlobals();
  });
  const send = (data: Snapshot) => {
    shown = data;
    act(() => {
      FakeEventSource.last.emit("snapshot", data);
    });
  };
  if (snapshot) send(snapshot);
  return {
    posts: record.posts,
    fetched: record.fetched,
    send,
    unmount,
    heard,
    inserts,
    insertResult,
    access,
    notices,
    checkWaiting,
  };
}
