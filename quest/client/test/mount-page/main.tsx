// The client mount's layout harness, served by the dev server only and
// never built (e2e/mount-layout.spec.ts): the client mounted on the hash
// router with every slot set, on an in-page fake stream that sends one
// snapshot of a Lesson step and nothing else.
import { playing, snapshotOf } from "../../e2e/snapshots";
import { createShownEvents } from "../../src/live/events";
import type { EventSourceLike } from "../../src/live/stream";
import { mountQuest } from "../../src/mount";
import type { ClientSlots } from "../../src/mount/types";

const snapshot = snapshotOf(playing);

/** The stream: the snapshot at once, and again now and then so it is never silent. */
class PageEventSource implements EventSourceLike {
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();
  private readonly timer: number;
  constructor() {
    const send = () => {
      for (const listener of this.listeners.get("snapshot") ?? [])
        listener(
          new MessageEvent("snapshot", { data: JSON.stringify(snapshot) }),
        );
    };
    window.setTimeout(send, 0);
    this.timer = window.setInterval(send, 5000);
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close() {
    window.clearInterval(this.timer);
  }
}

const NO_NOTICES: readonly [] = [];

const slots: ClientSlots = {
  practicePane: () => (
    // The app's stylesheet builds only the utilities its own source names.
    <div
      data-test-terminal=""
      style={{ height: "100%", background: "var(--color-code-bg)" }}
    >
      <textarea aria-label="Terminal input" />
    </div>
  ),
  command: { action: "insert", insert: () => "inserted" },
  where: {
    labels: {
      terminal: "Terminal",
      claude: "Terminal · claude",
      "claude-2": "Terminal 2 · claude",
      shell: "Terminal · shell",
      editor: "Terminal · files",
      browser: "Terminal · browser",
    },
    focus: () => undefined,
  },
  stepActionsStart: () => <button type="button">Reset step</button>,
  topBarEnd: () => <button type="button">Sign in</button>,
  copy: { productName: "Harness", waitingLine: "Getting your Lesson ready…" },
  checkWaiting: { get: () => null, subscribe: () => () => undefined },
  // get() returns one value until it changes: a new [] each call would loop.
  notices: { get: () => NO_NOTICES, subscribe: () => () => undefined },
};

const root = document.getElementById("root");
if (!root) throw new Error("the harness has no #root");
if (window.location.hash === "") window.location.hash = "#/lesson/b-1/step";
mountQuest(root, {
  slots,
  live: {
    EventSource: PageEventSource,
    setTimeout: (run, ms) => window.setTimeout(run, ms),
    clearTimeout: (handle) => {
      window.clearTimeout(handle as number);
    },
    hidden: () => false,
    onVisibility: () => () => undefined,
    now: () => Date.now(),
    shown: () => createShownEvents(null),
    fetch: () =>
      Promise.resolve(
        Response.json({ revision: 1, snapshot }, { status: 200 }),
      ),
  },
});
