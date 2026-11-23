// The Scene's sound (09 9.5): nothing before the first interaction, mute
// at once and kept, a hidden tab and the Practice terminal silent, a cue
// cut short when its moment is, and silence where the page has no audio.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  FakeAudioContext,
  resetAudio,
  startedNotes,
} from "../../../test/audio";
import { CUES, SOUND_CUES, cueLength } from "./cues";
import { createSoundEngine, terminalHolds, type SoundEngine } from "./engine";

let engine: SoundEngine;
let stop: () => void;

function make(audio: () => AudioContext | null = fakeAudio): void {
  engine = createSoundEngine({ win: window, doc: document, audio });
  stop = engine.start();
}

const fakeAudio = () => new FakeAudioContext() as unknown as AudioContext;

/** The Learner's own interaction, as the page hears it. */
function gesture(type = "pointerdown"): void {
  window.dispatchEvent(new Event(type));
}

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  resetAudio();
});

afterEach(() => {
  stop();
  vi.restoreAllMocks();
  localStorage.clear();
  Reflect.deleteProperty(document, "visibilityState");
  document.body.replaceChildren();
});

describe("before the first interaction", () => {
  test("nothing plays, no audio is made, and nothing waits to play after it", () => {
    make();
    engine.play("screen");
    engine.play("check");
    expect(FakeAudioContext.made).toHaveLength(0);
    gesture();
    expect(startedNotes()).toHaveLength(0);
    engine.play("check");
    expect(startedNotes()).toHaveLength(CUES.check.length);
  });

  test("a key counts, but Esc does not", () => {
    make();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    engine.play("screen");
    expect(startedNotes()).toHaveLength(0);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    engine.play("screen");
    expect(startedNotes()).toHaveLength(1);
  });

  test("the first gesture starts the audio", () => {
    make();
    gesture("keydown");
    expect(FakeAudioContext.made).toHaveLength(1);
    expect(FakeAudioContext.made[0]?.state).toBe("running");
  });
});

describe("mute", () => {
  test("silences every playing cue at once and plays none after", () => {
    make();
    gesture();
    engine.play("badge-reveal");
    engine.play("check");
    const [ctx] = FakeAudioContext.made;
    if (ctx === undefined) throw new Error("no audio");
    ctx.currentTime = 0.2;
    engine.setMuted(true);
    for (const osc of startedNotes())
      expect(osc.stopped).toBeLessThanOrEqual(0.25);
    const before = startedNotes().length;
    engine.play("check");
    expect(startedNotes()).toHaveLength(before);
  });

  test("is kept beside quest.motion, holds across a new page, and on again plays", () => {
    make();
    gesture();
    engine.setMuted(true);
    expect(localStorage.getItem("quest.sound")).toBe("off");
    stop();
    make();
    expect(engine.muted()).toBe(true);
    gesture();
    engine.play("check");
    expect(startedNotes()).toHaveLength(0);
    engine.setMuted(false);
    expect(localStorage.getItem("quest.sound")).toBeNull();
    engine.play("check");
    expect(startedNotes()).toHaveLength(CUES.check.length);
  });

  test("works for the page when storage refuses it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    make();
    gesture();
    engine.setMuted(true);
    expect(engine.muted()).toBe(true);
    engine.play("check");
    expect(startedNotes()).toHaveLength(0);
  });

  test("a muted first gesture makes no audio; turning it on does", () => {
    localStorage.setItem("quest.sound", "off");
    make();
    gesture();
    expect(FakeAudioContext.made).toHaveLength(0);
    engine.setMuted(false);
    expect(FakeAudioContext.made[0]?.state).toBe("running");
  });

  test("tells its listeners, and follows another tab's choice", () => {
    make();
    gesture();
    const heard = vi.fn();
    engine.subscribe(heard);
    engine.setMuted(true);
    expect(heard).toHaveBeenCalledTimes(1);
    localStorage.removeItem("quest.sound");
    window.dispatchEvent(new StorageEvent("storage", { key: "quest.sound" }));
    expect(engine.muted()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: "quest.theme" }));
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe("a hidden tab", () => {
  test("plays nothing, and hiding silences what plays and suspends the audio", () => {
    make();
    gesture();
    engine.play("badge-reveal");
    const [ctx] = FakeAudioContext.made;
    setHidden(true);
    expect(ctx?.state).toBe("suspended");
    for (const osc of startedNotes()) expect(osc.stopped).toBeLessThan(0.1);
    const before = startedNotes().length;
    engine.play("check");
    expect(startedNotes()).toHaveLength(before);
    setHidden(false);
    expect(ctx?.state).toBe("running");
    engine.play("check");
    expect(startedNotes()).toHaveLength(before + CUES.check.length);
  });
});

describe("the Practice terminal", () => {
  function pane(): HTMLElement {
    const el = document.createElement("div");
    el.dataset.practicePane = "";
    const input = document.createElement("textarea");
    el.append(input);
    document.body.append(el);
    return el;
  }

  test("no cue starts while its pane has focus or marks output in flight", () => {
    make();
    gesture();
    const el = pane();
    el.querySelector("textarea")?.focus();
    expect(terminalHolds(document)).toBe(true);
    engine.play("check");
    engine.play("screen");
    expect(startedNotes()).toHaveLength(0);
    (document.activeElement as HTMLElement).blur();
    const busy = document.createElement("span");
    busy.dataset.practiceBusy = "";
    el.append(busy);
    engine.play("check");
    expect(startedNotes()).toHaveLength(0);
    busy.remove();
    engine.play("check");
    expect(startedNotes()).toHaveLength(CUES.check.length);
  });

  test("a leaving screen's inert copy of the pane holds nothing", () => {
    const copy = document.createElement("div");
    copy.setAttribute("inert", "");
    copy.append(pane());
    const busy = document.createElement("span");
    busy.setAttribute("data-practice-busy", "");
    copy.querySelector("[data-practice-pane]")?.append(busy);
    document.body.append(copy);
    copy.querySelector("textarea")?.focus();
    expect(terminalHolds(document)).toBe(false);
  });
});

describe("a cue", () => {
  test("stop and its signal cut it short", () => {
    make();
    gesture();
    const play = engine.play("badge-reveal");
    const [ctx] = FakeAudioContext.made;
    if (ctx === undefined) throw new Error("no audio");
    ctx.currentTime = 0.3;
    play.stop();
    for (const osc of startedNotes()) expect(osc.stopped).toBeLessThan(0.35);
    const moved = new AbortController();
    engine.play("screen", { signal: moved.signal });
    ctx.currentTime = 0.4;
    moved.abort();
    expect(startedNotes().at(-1)?.stopped).toBeLessThan(0.45);
    engine.play("screen", { signal: moved.signal });
    expect(startedNotes()).toHaveLength(CUES["badge-reveal"].length + 1);
  });

  test("ends within the cap it is given", () => {
    make();
    gesture();
    engine.play("check", { within: 0.12 });
    for (const osc of startedNotes())
      expect(osc.stopped).toBeLessThanOrEqual(0.12 + 0.03);
  });

  test("each named moment has its own, the transition's within the Motion standard's cap and the reveal's about as long as the reveal", () => {
    expect(SOUND_CUES).toEqual(Object.keys(CUES));
    expect(
      new Set(SOUND_CUES.map((cue) => JSON.stringify(CUES[cue]))).size,
    ).toBe(SOUND_CUES.length);
    expect(cueLength("screen")).toBeLessThanOrEqual(0.36);
    expect(cueLength("badge-reveal")).toBeGreaterThan(1.2);
    expect(cueLength("badge-reveal")).toBeLessThanOrEqual(1.6);
    for (const cue of SOUND_CUES)
      for (const note of CUES[cue]) {
        expect(note.level).toBeGreaterThan(0);
        expect(note.level).toBeLessThanOrEqual(0.3);
      }
  });

  test("a page with no Web Audio, or one that refuses it, is silent and never throws", () => {
    make(() => null);
    gesture();
    expect(() => {
      engine.play("check").stop();
    }).not.toThrow();
    stop();
    vi.stubGlobal("AudioContext", function Refuses() {
      throw new Error("not allowed");
    });
    engine = createSoundEngine();
    stop = engine.start();
    gesture();
    expect(() => {
      engine.play("check").stop();
    }).not.toThrow();
    vi.unstubAllGlobals();
  });

  test("the stop closes the audio and listens no more", () => {
    make();
    gesture();
    const [ctx] = FakeAudioContext.made;
    stop();
    expect(ctx?.state).toBe("closed");
    gesture();
    expect(FakeAudioContext.made).toHaveLength(1);
  });
});
