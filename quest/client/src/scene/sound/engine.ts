// The Scene's sound (09 9.5): one page's player of the cues in cues.ts.
// Browsers start audio only from a user gesture, so nothing plays, and
// nothing waits to play, before the Learner's first interaction with the
// page. After it, a cue plays unless the sound is off, the page is hidden,
// or the Practice terminal has focus or plays output: no sound ever starts
// in or from the terminal. A page with no Web Audio is silent, never in error.
import { applySound, readSound, SOUND_KEY } from "../../lib/settings";
import { CUES, cueLength, type Note, type SoundCue } from "./cues";

/** A cue as it plays: `stop` cuts it short, as a skipped moment does. */
export interface SoundPlay {
  stop: () => void;
}

export interface PlayOptions {
  /** Cuts the cue short when it aborts, as the next screen change does. */
  signal?: AbortSignal;
  /** The longest the cue may ring, in seconds: a transition's cap; none when not above 0. */
  within?: number;
}

export interface SoundEngine {
  play: (cue: SoundCue, options?: PlayOptions) => SoundPlay;
  /** Whether the Learner turned the sound off. */
  muted: () => boolean;
  /** Turns the sound off, which silences every cue at once, or on again; kept in this browser. */
  setMuted: (muted: boolean) => void;
  /** Called when muted changes. */
  subscribe: (fn: () => void) => () => void;
  /** Listens to the page while sound may play; the returned stop closes the audio. */
  start: () => () => void;
}

/** The page the engine plays in: its window, document and audio, so tests can supply their own. */
export interface SoundPage {
  win: Window;
  doc: Document;
  /** A new audio context, or null where the page has none. */
  audio: () => AudioContext | null;
}

function pageAudio(): AudioContext | null {
  if (typeof AudioContext !== "function") return null;
  try {
    return new AudioContext({ latencyHint: "interactive" });
  } catch {
    return null;
  }
}

/** The page's own window, document and audio. */
export function soundPage(): SoundPage {
  return { win: window, doc: document, audio: pageAudio };
}

/** The input that counts as the Learner's own interaction, as browsers count it for audio. */
const GESTURES = ["pointerdown", "pointerup", "keydown", "touchend", "click"];

/** The page's volume over every cue. */
const VOLUME = 0.5;
/** A note's rise, so it never clicks in. */
const ATTACK = 0.008;
/** The fade a cut-short cue takes, so it never clicks out. */
const CUT = 0.015;
/** The quietest gain an exponential fade can reach, near silence. */
const FLOOR = 0.0001;
/** A breath after now, so the first note's start is never in the past. */
const LEAD = 0.005;

/** A cue that never played. */
const SILENT: SoundPlay = { stop: () => undefined };

/**
 * Whether the Practice terminal holds the page: focus is in its pane, or
 * the pane marks output in flight (`data-practice-busy`). A leaving
 * screen's copy is `inert` and counts for neither.
 */
export function terminalHolds(doc: Document): boolean {
  const active = doc.activeElement;
  for (const pane of doc.querySelectorAll("[data-practice-pane]")) {
    if (pane.closest("[inert]") !== null) continue;
    if (active !== null && pane.contains(active)) return true;
    if (pane.querySelector("[data-practice-busy]") !== null) return true;
  }
  return false;
}

interface Voice {
  cut: () => void;
}

export function createSoundEngine(page: SoundPage = soundPage()): SoundEngine {
  const { win, doc } = page;
  let muted = readSound() === "off";
  // A gesture was seen: audio may start from now on.
  let activated = false;
  let audio: AudioContext | null = null;
  let out: GainNode | null = null;
  // A gesture asked the audio to resume and the browser has not finished:
  // Firefox and Safari start a context so, and a cue asked for meanwhile
  // sounds as it starts. A context suspended with no such resume (a tab
  // back without a gesture, as Safari keeps one) would hold its notes and
  // sound them all at the next gesture, so its cues are dropped.
  let starting = false;
  const voices = new Set<Voice>();
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const fn of [...listeners]) fn();
  };

  const hidden = () => doc.visibilityState === "hidden";

  /** The audio context, made on first need after a gesture; null where there is none. */
  const context = (): AudioContext | null => {
    if (audio !== null) return audio;
    audio = page.audio();
    if (audio === null) return null;
    out = audio.createGain();
    out.gain.value = VOLUME;
    out.connect(audio.destination);
    return audio;
  };

  /** Asks a suspended context to run; `byGesture` when the Learner's own input asks. */
  const resume = (ctx: AudioContext, byGesture: boolean) => {
    if (byGesture) starting = true;
    ctx
      .resume()
      .catch(() => undefined)
      .finally(() => {
        if (ctx.state === "running" || byGesture) starting = false;
      });
  };

  /** Starts the audio once a gesture was seen, while the sound is on and the page shows. */
  const wake = (byGesture: boolean) => {
    if (!activated || muted || hidden()) return;
    const ctx = context();
    if (ctx !== null && ctx.state !== "running") resume(ctx, byGesture);
  };

  const silenceAll = () => {
    for (const voice of [...voices]) voice.cut();
  };

  const onGesture = (event: Event) => {
    // Esc and a key the browser does not count leave the page without
    // activation; a browser with no userActivation counts every other one.
    const activation = win.navigator.userActivation as
      UserActivation | undefined;
    if (activation !== undefined && !activation.isActive) return;
    if (event instanceof KeyboardEvent && event.key === "Escape") return;
    activated = true;
    wake(true);
  };

  const onVisibility = () => {
    if (hidden()) {
      silenceAll();
      starting = false;
      audio?.suspend().catch(() => undefined);
    } else wake(false);
  };

  // Another tab turned the sound off or on.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SOUND_KEY && event.key !== null) return;
    const next = readSound() === "off";
    if (next === muted) return;
    muted = next;
    if (muted) silenceAll();
    changed();
  };

  const playNote = (
    ctx: AudioContext,
    to: AudioNode,
    note: Note,
    start: number,
    end: number,
  ) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.pitch, start);
    if (note.glide !== undefined)
      osc.frequency.exponentialRampToValueAtTime(note.glide, end);
    env.gain.setValueAtTime(FLOOR, start);
    env.gain.linearRampToValueAtTime(note.level, Math.min(start + ATTACK, end));
    env.gain.exponentialRampToValueAtTime(FLOOR, end);
    osc.connect(env);
    env.connect(to);
    osc.start(start);
    osc.stop(end + CUT);
    return osc;
  };

  return {
    play: (cue, options = {}) => {
      const { signal, within } = options;
      if (!activated || muted || hidden() || signal?.aborted === true)
        return SILENT;
      if (terminalHolds(doc)) return SILENT;
      const ctx = context();
      if (ctx === null || out === null) return SILENT;
      // Held suspended, not starting: dropped, so it never sounds later.
      if (ctx.state !== "running" && !starting) {
        resume(ctx, false);
        return SILENT;
      }
      const bus = ctx.createGain();
      bus.connect(out);
      const t0 = ctx.currentTime + LEAD;
      // A cap the page could not read (no tokens) leaves the cue its own length.
      const cap = within !== undefined && within > 0 ? within : Infinity;
      const last = t0 + Math.min(cueLength(cue), cap);
      const oscs: OscillatorNode[] = [];
      // The note that rings last, whose end lets the voice go.
      let final: { osc: OscillatorNode; end: number } | null = null;
      for (const note of CUES[cue]) {
        const start = t0 + note.at;
        if (start >= last) continue;
        const end = Math.min(start + note.hold, last);
        const osc = playNote(ctx, bus, note, start, end);
        oscs.push(osc);
        if (final === null || end >= final.end) final = { osc, end };
      }
      let done = false;
      const voice: Voice = {
        cut: () => {
          if (done) return;
          done = true;
          voices.delete(voice);
          signal?.removeEventListener("abort", voice.cut);
          const now = ctx.currentTime;
          bus.gain.cancelScheduledValues(now);
          bus.gain.setValueAtTime(bus.gain.value, now);
          bus.gain.linearRampToValueAtTime(0, now + CUT);
          for (const osc of oscs) {
            try {
              osc.stop(now + CUT);
            } catch {
              // Already stopped.
            }
          }
        },
      };
      voices.add(voice);
      // Let go of the voice once its notes are over.
      if (final !== null)
        final.osc.onended = () => {
          done = true;
          voices.delete(voice);
          signal?.removeEventListener("abort", voice.cut);
        };
      signal?.addEventListener("abort", voice.cut);
      return { stop: voice.cut };
    },
    muted: () => muted,
    setMuted: (next) => {
      if (next === muted) return;
      muted = next;
      applySound(muted ? "off" : "on");
      // Turned on by a press or a key, whose gesture was heard first.
      if (muted) silenceAll();
      else wake(true);
      changed();
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    start: () => {
      const capture = { capture: true, passive: true } as const;
      for (const type of GESTURES)
        win.addEventListener(type, onGesture, capture);
      doc.addEventListener("visibilitychange", onVisibility);
      win.addEventListener("storage", onStorage);
      return () => {
        for (const type of GESTURES)
          win.removeEventListener(type, onGesture, capture);
        doc.removeEventListener("visibilitychange", onVisibility);
        win.removeEventListener("storage", onStorage);
        silenceAll();
        audio?.close().catch(() => undefined);
        audio = null;
        out = null;
        starting = false;
      };
    },
  };
}
