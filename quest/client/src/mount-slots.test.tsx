// A mount with every slot set renders each slot where 05 5.10 places it.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Snapshot } from "@quest/contract";
import {
  cardEntries,
  beginnerDone,
  checkRunning,
  complete,
  completeCapstone,
  courseDone,
  exactTaken,
  levelCompleted,
  overview,
  overviewAt,
  passedMiddle,
  playing,
  playingWith,
  snapshotOf,
} from "../e2e/snapshots";
import { renderMounted } from "../test/mounted";
import { Journey, Welcome } from "./mount";
import { WAITING_MS } from "./shell/Shell";

const STEP = "/lesson/b-1/step/";
const step = snapshotOf(playing);

function topBar(): HTMLElement {
  const header = document.querySelector<HTMLElement>("[data-top] header");
  if (header === null) throw new Error("no top bar");
  return header;
}

function one(selector: string): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>(selector);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("every slot where 5.10 places it", () => {
  test("practicePane renders beside the Lesson column on /lesson/:id/step/ with the beat on screen, and the action bar stays inside the column", () => {
    renderMounted(STEP, step);
    const regions = one("[data-lesson-regions]");
    const column = one("[data-lesson-column]");
    const pane = one("[data-practice-pane]");
    expect([...regions.children]).toEqual([column, pane]);
    expect(pane).toHaveAttribute("data-pip-target", "work");
    expect(pane).toHaveTextContent("b-1 C 0 terminal null");
    expect(column).toContainElement(screen.getByRole("main"));
    const bar = screen.getByRole("region", { name: "Step actions" });
    expect(column).toContainElement(bar);
    expect(bar).toHaveAttribute("data-inline");
    // The strip's More toggle sits between the Lesson and its bar.
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(before(more, bar)).toBe(true);
  });

  test("practicePane's onInput collapses the expanded strip, and focus in the pane alone keeps it", async () => {
    renderMounted(STEP, step);
    const more = screen.getByRole("button", { name: "More" });
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const send = screen.getByRole("button", { name: "Send input" });
    act(() => {
      send.focus();
    });
    expect(more).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(send);
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(more).toHaveTextContent("More");
  });

  test("command insert: a Step's command and the exact hint rung read Insert and send InsertRequest; the skills card keeps Copy", async () => {
    const mounted = renderMounted(STEP, {
      ...snapshotOf(exactTaken),
      learner: { ...step.learner, card: cardEntries },
    });
    const inserts = screen.getAllByRole("button", {
      name: "Insert npm run check -- b-1",
    });
    // The beat's run line and the exact command's rung.
    expect(inserts).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: /^Copy npm/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(inserts[1] as HTMLElement);
    expect(mounted.inserts).toEqual([
      { text: "npm run check -- b-1", where: "terminal", terminal: null },
    ]);
    const card = inserts[1]?.closest("[data-pip-target=command]");
    expect(within(card as HTMLElement).getByRole("status")).toHaveTextContent(
      "Inserted",
    );
    // A draft was there: the page asks, so nothing is announced.
    mounted.insertResult.next = "asked";
    await userEvent.click(inserts[0] as HTMLElement);
    expect(mounted.inserts).toHaveLength(2);
    const first = inserts[0]?.closest("[data-pip-target=command]");
    expect(
      within(first as HTMLElement).getByRole("status"),
    ).toBeEmptyDOMElement();

    await userEvent.click(
      within(topBar()).getByRole("button", { name: "Your card" }),
    );
    const panel = await screen.findByRole("dialog", { name: "Your card" });
    expect(
      within(panel).getByRole("button", { name: "Copy Esc" }),
    ).toBeVisible();
    expect(
      within(panel).queryByRole("button", { name: /^Insert/ }),
    ).not.toBeInTheDocument();
  });

  test("where: the chip reads the label and pressing it calls focus(kind, terminal)", async () => {
    const mounted = renderMounted(STEP, step);
    const chip = screen.getByRole("button", { name: "Terminal" });
    expect(chip).toHaveAttribute("data-where", "terminal");
    await userEvent.click(chip);
    expect(mounted.heard).toEqual(["focus:terminal:null"]);

    mounted.unmount();
    const second = renderMounted(
      STEP,
      snapshotOf(
        playingWith({
          step: { where: { kind: "claude-2", terminal: 2, folder: null } },
          beat: { decidedBy: "check" },
        }),
      ),
    );
    // The label carries its number: none is added.
    const claude = screen.getByRole("button", { name: "Terminal 2 · claude" });
    expect(claude.querySelector("b")).toHaveTextContent(
      /^Terminal 2 · claude$/,
    );
    await userEvent.click(claude);
    expect(second.heard).toEqual(["focus:claude-2:2"]);
  });

  test("stepActionsStart opens the step actions, before Back", () => {
    renderMounted(STEP, step);
    const bar = screen.getByRole("region", { name: "Step actions" });
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Reset step",
      "Back",
      "Check again",
    ]);
  });

  test("settingsSections show in Settings; settingsHide hides Work folders, release and Codespace", async () => {
    renderMounted(STEP, step);
    await userEvent.click(
      within(topBar()).getByRole("button", { name: "Settings" }),
    );
    const panel = await screen.findByRole("dialog", { name: "Settings" });
    const a = within(panel).getByText("Account");
    const b = within(panel).getByText("Storage");
    const help = within(panel).getByRole("heading", { name: "Help" });
    expect(before(a, b) && before(b, help)).toBe(true);
    expect(
      within(panel).queryByRole("heading", { name: "Work folders" }),
    ).not.toBeInTheDocument();
    expect(panel.querySelector('[data-settings="work-folders"]')).toBeNull();
    expect(panel).not.toHaveTextContent(/Release|Built from commit/);
    expect(panel).not.toHaveTextContent("Codespace");
  });

  test("topBarEnd ends the top bar's main nav", () => {
    renderMounted(STEP, step);
    const nav = within(topBar()).getByRole("navigation", { name: "Main" });
    expect(nav.lastElementChild).toHaveTextContent("Sign in");
    expect(nav.lastElementChild?.previousElementSibling).toHaveAccessibleName(
      "Settings",
    );
  });

  test("lessonCompleteExtra gets the lesson, before Next", () => {
    renderMounted("/lesson/b-1/complete/", snapshotOf(complete));
    const extra = one("[data-test-lesson-extra]");
    expect(extra).toHaveTextContent("Extra for b-1");
    const next = screen.getByRole("button", { name: /^Next:/ });
    expect(before(extra, next)).toBe(true);
    const badge = screen.getByRole("heading", { level: 1 });
    expect(before(badge, extra)).toBe(true);
  });

  test("courseCompleteExtra renders on Course complete", () => {
    renderMounted(
      "/course/complete/",
      snapshotOf(complete, { course: courseDone }),
    );
    const extra = one("[data-test-course-extra]");
    const progress = screen.getByRole("link", { name: /See your progress/ });
    expect(before(extra, progress)).toBe(true);
    const lists = document.querySelectorAll("main section");
    const last = lists[lists.length - 1];
    expect(last && before(last, extra)).toBe(true);
  });

  test("lessonAccess keep-going replaces Start with the offer; needs-connection disables Start and shows the offer; a change re-renders", async () => {
    const mounted = renderMounted("/lesson/b-1/", snapshotOf(overview));
    expect(screen.getByRole("button", { name: "Start" })).toBeVisible();
    expect(document.querySelector("[data-test-offer]")).toBeNull();

    mounted.access.set({ "b-1": { open: false, offer: "keep-going" } });
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Start with less help" }),
    ).toBeNull();
    expect(one("[data-test-offer]")).toHaveTextContent(
      "Offer keep-going for b-1",
    );

    mounted.access.set({ "b-1": { open: false, offer: "needs-connection" } });
    const start = screen.getByRole("button", { name: "Start" });
    expect(start).toHaveAttribute("aria-disabled", "true");
    const offer = one("[data-test-offer=needs-connection]");
    expect(before(offer, start)).toBe(true);
    await userEvent.click(start);
    expect(mounted.posts).toEqual([]);

    mounted.access.set({});
    expect(document.querySelector("[data-test-offer]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => {
      expect(mounted.posts.map((p) => p.action.type)).toEqual(["lesson.start"]);
    });
  });

  test("lessonAccess on the step route: a closed Lesson shows the offer in place of the step and the pane, as a resume or a deep link meets it", () => {
    const mounted = renderMounted(STEP, step);
    expect(one("[data-practice-pane]")).toBeInTheDocument();

    mounted.access.set({ "b-1": { open: false, offer: "keep-going" } });
    expect(document.querySelector("[data-practice-pane]")).toBeNull();
    expect(document.querySelector("[data-lesson-regions]")).toBeNull();
    expect(one("[data-lesson-closed]")).toHaveAttribute(
      "data-lesson-closed",
      "keep-going",
    );
    expect(one("[data-test-offer]")).toHaveTextContent(
      "Offer keep-going for b-1",
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(window.location.pathname).toBe(STEP);

    mounted.access.set({ "b-1": { open: false, offer: "needs-connection" } });
    expect(one("[data-test-offer]")).toHaveTextContent(
      "Offer needs-connection for b-1",
    );

    mounted.access.set({});
    expect(document.querySelector("[data-test-offer]")).toBeNull();
    expect(one("[data-practice-pane]")).toBeInTheDocument();
  });

  test("copy: productName in the tab title and course complete, waitingLine on Welcome, welcomeLine once", async () => {
    renderMounted(STEP, step).unmount();
    expect(document.title).toMatch(/ · Test Product$/);
    expect(document.title).not.toContain("Claude Code Quest");

    const course = renderMounted(
      "/course/complete/",
      snapshotOf(complete, { course: courseDone }),
    );
    expect(
      screen.getByRole("heading", { name: "You finished Test Product" }),
    ).toBeVisible();
    course.unmount();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const waiting = renderMounted("/", null);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(WAITING_MS);
      });
      expect(one("[data-waiting-line]")).toHaveTextContent(
        /^Getting your Lesson ready…$/,
      );
      waiting.unmount();
    } finally {
      vi.useRealTimers();
    }

    renderMounted("/", snapshotOf(overview));
    expect(one("[data-welcome-line]")).toHaveTextContent(
      "The Lesson is on one side.",
    );
  });

  test("brand: mark and title in the top bar", () => {
    renderMounted(STEP, step);
    const header = topBar();
    expect(header.querySelector("[data-test-mark]")).not.toBeNull();
    expect(header.querySelector("[data-pip]")).toBeNull();
    expect(header).toHaveTextContent("Test Product");
    expect(header).not.toHaveTextContent("Claude Code Quest");
  });

  test("notices: each notice with its tone and action, following subscribe", async () => {
    const mounted = renderMounted(STEP, step);
    expect(document.querySelectorAll("[data-mount-notice]")).toHaveLength(0);
    const run = vi.fn();
    mounted.notices.set([
      { id: "paused", text: "Paused while you were away.", tone: "wait" },
      {
        id: "update",
        text: "Update ready, reload when you like.",
        tone: "info",
        action: { label: "Reload", run },
      },
    ]);
    const paused = one("[data-mount-notice=paused]");
    const update = one("[data-mount-notice=update]");
    expect(paused).toHaveAttribute("data-tone", "wait");
    expect(paused.querySelector(".animate-breathe")).not.toBeNull();
    expect(update).toHaveAttribute("data-tone", "info");
    expect(update.querySelector(".animate-breathe")).toBeNull();
    expect(one("[data-top]")).toContainElement(paused);
    const region = one("[data-mount-notices-region]");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Update ready, reload when you like.");
    await userEvent.click(
      within(update).getByRole("button", { name: "Reload" }),
    );
    expect(run).toHaveBeenCalledOnce();

    mounted.notices.set([]);
    expect(document.querySelectorAll("[data-mount-notice]")).toHaveLength(0);
    expect(region).toBeEmptyDOMElement();
  });

  test("checkLinesExtra under the Check lines with the beat key and pass", () => {
    renderMounted(STEP, step);
    const extra = one("[data-test-lines-extra]");
    expect(extra).toHaveTextContent("b-1:C:0 miss");
    const lines = one("[data-step-card] [data-pip-target=lines]");
    expect(before(lines, extra)).toBe(true);
    expect(one("[data-step-card]")).toContainElement(extra);
  });

  test("checkWaiting replaces the running line on a pending Check bubble and null restores it", () => {
    const mounted = renderMounted(STEP, snapshotOf(checkRunning));
    const bubble = () => one("[data-says-bubble] [aria-atomic]");
    const running = bubble().textContent;
    expect(running).not.toContain("Waiting for your shell command");

    mounted.checkWaiting.set("Waiting for your shell command");
    expect(bubble()).toHaveTextContent(/^Waiting for your shell command$/);

    mounted.checkWaiting.set(null);
    expect(bubble().textContent).toBe(running);
  });

  test("onStepNext runs synchronously inside the Next click, before the action is sent", async () => {
    const done = snapshotOf(
      playingWith({ beat: { decidedBy: "learner", status: "done" } }),
    );
    const mounted = renderMounted(STEP, done);
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(mounted.heard).toEqual(["next:C:0"]);
    await waitFor(() => {
      expect(mounted.posts.map((p) => p.action.type)).toEqual([
        "step.continue",
      ]);
    });
  });

  test.each([
    { label: "Next", row: false },
    { label: "a completed forward row", row: true },
  ])(
    "onStepNext runs before step.visit from the Steps panel's $label",
    async ({ row }) => {
      const current = passedMiddle.step;
      const target = passedMiddle.steps[3];
      if (!current || !target) throw new Error("the middle Steps are missing");
      const mounted = renderMounted(
        STEP,
        snapshotOf({
          ...passedMiddle,
          steps: passedMiddle.steps.map((step, index) => ({
            ...step,
            state:
              index <= (row ? 3 : 2) ? ("done" as const) : ("todo" as const),
          })),
        }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Steps" }));
      const dialog = screen.getByRole("dialog", { name: "Steps" });
      await userEvent.click(
        row
          ? within(dialog).getByRole("button", {
              name: new RegExp(target.title),
            })
          : within(dialog).getByRole("button", { name: "Next" }),
      );
      expect(mounted.heard).toEqual([`next:${current.id}:0`]);
      await waitFor(() => {
        expect(mounted.posts.map((p) => p.action)).toEqual([
          { type: "step.visit", step: target.id },
        ]);
      });
    },
  );

  test("browser router: a slashless path is replaced with its slash form, added routes render inside the shell, a welcome handle hides the top bar, a settings handle opens Settings, and nav current marks hold on slash paths", async () => {
    const routes = [
      { path: "welcome", Component: Welcome, handle: { screen: "welcome" } },
      {
        path: "settings",
        Component: Journey,
        handle: { screen: "journey", settings: true },
      },
      { path: "added", Component: () => <main data-test-added="" /> },
    ];
    const journey = snapshotOf(overview);
    const at = (path: string, snapshot: Snapshot) =>
      renderMounted(path, snapshot, { routes });

    let mounted = at("/journey", journey);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/journey/");
    });
    const main = within(topBar()).getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Journey" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    mounted.unmount();

    mounted = at("/added/", journey);
    expect(one("[data-screen]")).toContainElement(one("[data-test-added]"));
    expect(screen.queryByRole("heading", { name: /not found/i })).toBeNull();
    mounted.unmount();

    mounted = at("/welcome/", journey);
    expect(document.querySelector("[data-top] header")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Learn Claude Code by using it." }),
    ).toBeVisible();
    mounted.unmount();

    mounted = at("/settings", journey);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/settings/");
    });
    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeVisible();
    mounted.unmount();

    at("/lesson/b-1", journey);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/lesson/b-1/");
    });
    const where = within(topBar()).getByRole("navigation", {
      name: "Where you are",
    });
    const current = within(where)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/lesson/b-1/");
  });
  test("browser router: every same-origin link on every screen is written with its trailing slash, and opening a Lesson navigates to its slash path", async () => {
    const screens: [string, Snapshot][] = [
      ["/journey/", snapshotOf(overview)],
      ["/progress/", snapshotOf(overview)],
      ["/lesson/b-2/", snapshotOf(overview)],
      ["/lesson/b-1/complete/", snapshotOf(complete)],
      [
        "/lesson/b-capstone/complete/",
        snapshotOf(completeCapstone, {
          course: beginnerDone,
          milestones: levelCompleted,
        }),
      ],
      [
        "/level/b/complete/",
        snapshotOf(completeCapstone, {
          course: beginnerDone,
          milestones: levelCompleted,
        }),
      ],
      ["/course/complete/", snapshotOf(complete, { course: courseDone })],
      ["/nope/", snapshotOf(overview)],
    ];
    for (const [path, snapshot] of screens) {
      const mounted = renderMounted(path, snapshot, { slots: {} });
      await screen.findByRole("heading", { level: 1 });
      const hrefs = [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href") ?? "")
        .filter((href) => href.startsWith("/") && !href.startsWith("//"));
      expect(hrefs.length, path).toBeGreaterThan(0);
      for (const href of hrefs)
        expect(href.split(/[?#]/)[0], `${path}: ${href}`).toMatch(/\/$/);
      mounted.unmount();
    }

    // Browsing b-2 shows its preview; opening it navigates by its slash path.
    const opened = renderMounted("/lesson/b-2/", snapshotOf(overview), {
      slots: {},
    });
    const urls: string[] = [];
    const record = (method: "pushState" | "replaceState") => {
      const real = window.history[method].bind(window.history);
      return vi
        .spyOn(window.history, method)
        .mockImplementation((data, unused, url) => {
          urls.push(String(url));
          real(data, unused, url);
        });
    };
    const spies = [record("pushState"), record("replaceState")];
    await userEvent.click(
      screen.getByRole("button", { name: "Open this lesson" }),
    );
    await waitFor(() => {
      expect(opened.posts.map((p) => p.action.type)).toEqual(["lesson.open"]);
    });
    opened.send(snapshotOf(overviewAt("b-2"), { revision: 2 }));
    await waitFor(() => {
      expect(urls).toContain("/lesson/b-2/");
    });
    // Never the bare path, so the trailing-slash rule had nothing to replace.
    expect(urls.filter((url) => !url.endsWith("/"))).toEqual([]);
    for (const spy of spies) spy.mockRestore();
  });
});
