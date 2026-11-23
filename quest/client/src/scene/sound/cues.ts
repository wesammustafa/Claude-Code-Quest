// The Scene's sounds (09 9.5), synthesised at runtime with the Web Audio
// API: no audio file, so nothing to fetch, cache or license. Each cue is a
// few soft notes, and each follows a moment the screen already shows.

/** The moments that have a sound. */
export type SoundCue =
  /** A screen transition (seam S11): it ends within the Motion standard's cap. */
  | "screen"
  /** A Check passing for the first time, while the Lesson column shows it. */
  | "check"
  /** The Badge reveal: about as long as the reveal, cut short by its skip. */
  | "badge-reveal"
  /** The Level run's one button. */
  | "level-run-jump"
  /** Pip collects a Badge in the Level run. */
  | "level-run-collect"
  /** The Level run ends, every Badge collected. */
  | "level-run-done";

export const SOUND_CUES: readonly SoundCue[] = [
  "screen",
  "check",
  "badge-reveal",
  "level-run-jump",
  "level-run-collect",
  "level-run-done",
];

/** One note: when it starts and how long it rings, in seconds from the cue's start. */
export interface Note {
  at: number;
  hold: number;
  /** Its pitch in hertz, and the pitch it glides to by its end, if any. */
  pitch: number;
  glide?: number;
  /** Its peak gain, from 0 to 1, before the page's own volume. */
  level: number;
  wave: "sine" | "triangle";
}

// Pitches in hertz, equal temperament from A4 at 440.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;
const B6 = 1975.53;

export const CUES: Readonly<Record<SoundCue, readonly Note[]>> = {
  // A short soft rise, under the screens' own exit and enter.
  screen: [
    { at: 0, hold: 0.16, pitch: G5, glide: C6, level: 0.18, wave: "sine" },
  ],
  // Two rising notes, as the Check lines turn to passed.
  check: [
    { at: 0, hold: 0.14, pitch: E5, level: 0.3, wave: "triangle" },
    { at: 0.09, hold: 0.32, pitch: B5, level: 0.3, wave: "triangle" },
  ],
  // A rising chord that settles as the Badge forms, about 1.5 s in all.
  "badge-reveal": [
    { at: 0, hold: 0.45, pitch: C5, level: 0.22, wave: "triangle" },
    { at: 0.25, hold: 0.45, pitch: E5, level: 0.22, wave: "triangle" },
    { at: 0.5, hold: 0.45, pitch: G5, level: 0.22, wave: "triangle" },
    { at: 0.8, hold: 0.7, pitch: C6, level: 0.28, wave: "triangle" },
    { at: 0.8, hold: 0.7, pitch: G6, level: 0.1, wave: "sine" },
  ],
  "level-run-jump": [
    { at: 0, hold: 0.09, pitch: E5, glide: B5, level: 0.16, wave: "sine" },
  ],
  "level-run-collect": [
    { at: 0, hold: 0.12, pitch: E6, level: 0.18, wave: "triangle" },
    { at: 0.05, hold: 0.16, pitch: B6, level: 0.14, wave: "sine" },
  ],
  "level-run-done": [
    { at: 0, hold: 0.3, pitch: G5, level: 0.22, wave: "triangle" },
    { at: 0.12, hold: 0.3, pitch: C6, level: 0.22, wave: "triangle" },
    { at: 0.24, hold: 0.45, pitch: E6, level: 0.22, wave: "triangle" },
  ],
};

/** How long a cue rings, in seconds: until its last note ends. */
export function cueLength(cue: SoundCue): number {
  return Math.max(...CUES[cue].map((note) => note.at + note.hold));
}
