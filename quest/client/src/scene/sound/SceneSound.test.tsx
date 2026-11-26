// The Scene's sound in the shell (09 9.5): on with the Scene's switch, a
// mute control on every screen, the screen cue on each route change and
// the Check cue on a first pass while the step shows. Without the switch
// the Local app has none of it.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuestEvent } from "@quest/contract";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { overview, playing, snapshotOf } from "../../../e2e/snapshots";
import {
  FakeAudioContext,
  resetAudio,
  startedNotes,
} from "../../../test/audio";
import { envelope } from "../../../test/events";
import { FakeEventSource } from "../../../test/live";
import { renderMounted } from "../../../test/mounted";
import type { SceneMount } from "../../mount/types";
import { resetTierProbes } from "../tier";
import { CUES } from "./cues";

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

/** A Scene whose renderer never arrives: the sound needs none of it. */
const scene: SceneMount = {
  load: () => new Promise(() => undefined),
  look: LOOK,
};

beforeEach(() => {
  resetTierProbes();
  resetAudio();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

/** Each test's audio, set after renderMounted, which unstubs the globals as it finishes. */
function giveAudio(): void {
  vi.stubGlobal("AudioContext", FakeAudioContext);
}

function go(path: string): void {
  act(() => {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const toggle = () => screen.queryByRole("button", { name: "Sound" });

function sendEvent(event: QuestEvent, revision: number): void {
  const sent = envelope(event, revision);
  act(() => {
    FakeEventSource.last.emit("event", sent, sent.id);
  });
}

describe("with the Scene off (the Local app)", () => {
  test("no mute control on any screen, no Sound in Settings, and no audio after a click", async () => {
    giveAudio();
    renderMounted("/journey/", snapshotOf(overview), { transitions: {} });
    await screen.findByRole("heading", { level: 1 });
    expect(toggle()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    const panel = await screen.findByRole("dialog", { name: "Settings" });
    expect(within(panel).queryByRole("group", { name: "Sound" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    go("/progress/");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(FakeAudioContext.made).toHaveLength(0);
  });

  test("Welcome has none either", async () => {
    renderMounted("/", snapshotOf(overview));
    await screen.findByRole("heading", { level: 1 });
    expect(toggle()).toBeNull();
  });
});

describe("with the Scene on", () => {
  test("the mute control is in the top bar, named Sound, pressed while on, and the keyboard turns it off and on", async () => {
    giveAudio();
    renderMounted("/journey/", snapshotOf(overview), { scene });
    await screen.findByRole("heading", { level: 1 });
    const button = toggle();
    expect(button?.closest("header")).not.toBeNull();
    expect(button).toHaveAttribute("aria-pressed", "true");
    button?.focus();
    await userEvent.keyboard("{Enter}");
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("quest.sound")).toBe("off");
    await userEvent.keyboard(" ");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("quest.sound")).toBeNull();
  });

  test("Welcome, with no top bar, has it too", async () => {
    renderMounted("/", snapshotOf(overview), { scene });
    await screen.findByRole("heading", { level: 1 });
    expect(document.querySelector("header")).toBeNull();
    expect(toggle()).not.toBeNull();
  });

  test("a muted choice holds on a new page, and Settings shows it and changes it with the control", async () => {
    localStorage.setItem("quest.sound", "off");
    renderMounted("/journey/", snapshotOf(overview), { scene });
    await screen.findByRole("heading", { level: 1 });
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    const panel = await screen.findByRole("dialog", { name: "Settings" });
    const group = within(panel).getByRole("group", { name: "Sound" });
    expect(within(group).getByRole("radio", { name: "Off" })).toBeChecked();
    await userEvent.click(within(group).getByRole("radio", { name: "On" }));
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("quest.sound")).toBeNull();
  });

  test("a route change before the first interaction plays nothing; after it, each plays the screen cue", async () => {
    giveAudio();
    renderMounted("/journey/", snapshotOf(overview), {
      scene,
      transitions: {},
    });
    await screen.findByRole("heading", { level: 1 });
    go("/progress/");
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(FakeAudioContext.made).toHaveLength(0);
    await userEvent.click(screen.getByRole("link", { name: "Journey" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/journey/");
    });
    expect(startedNotes()).toHaveLength(CUES.screen.length);
    await userEvent.click(toggle() as HTMLElement);
    await userEvent.click(screen.getByRole("link", { name: "Progress" }));
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(startedNotes()).toHaveLength(CUES.screen.length);
  });

  test("without screen transitions a route change plays nothing", async () => {
    giveAudio();
    renderMounted("/journey/", snapshotOf(overview), { scene });
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("link", { name: "Progress" }));
    await screen.findByRole("heading", { level: 1, name: "Progress" });
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(startedNotes()).toHaveLength(0);
  });

  test("a first Check pass on the step plays the Check cue, but not while the Practice terminal has focus; a repeat and a pass off the step play none", async () => {
    giveAudio();
    const page = renderMounted("/lesson/b-1/step/", snapshotOf(playing), {
      scene,
    });
    await screen.findByRole("heading", { level: 1 });
    // The Learner works in the terminal, and its Check passes.
    await userEvent.click(screen.getByRole("button", { name: "Send input" }));
    sendEvent({ type: "check.passed", firstTime: true }, 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(startedNotes()).toHaveLength(0);
    // Check again from the Lesson column.
    await userEvent.click(document.body);
    sendEvent({ type: "check.passed", firstTime: true }, 2);
    await waitFor(() => {
      expect(startedNotes()).toHaveLength(CUES.check.length);
    });
    // Pip's director hears the same pass: the page's consumers share the feed.
    await waitFor(() => {
      expect(document.querySelector("[data-pip-reaction]")).not.toBeNull();
    });
    sendEvent({ type: "check.passed", firstTime: false }, 3);
    page.send(snapshotOf(overview, { revision: 4 }));
    go("/journey/");
    await screen.findByRole("heading", { level: 1 });
    sendEvent({ type: "check.passed", firstTime: true }, 5);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(startedNotes()).toHaveLength(CUES.check.length);
  });
});
