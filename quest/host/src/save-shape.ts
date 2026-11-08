// The save's shape (seam S1): what the store keeps of the engine's state,
// field by field, so a hand-edited or newer file can't smuggle anything in.
// Pure: the path test for a saved work folder is given, so the host core
// and the browser can use it; store.ts binds it to node:path.
import type { EngineState } from "@quest/engine";
import { FOLDER_KEYS, HELP_USED, PATH_MAX, STEP_ID } from "./engine.ts";

// JSON as the file holds it, read field by field.
type Loose = Record<string, unknown>;

// What the store writes: format 1, with what sanitize keeps.
export interface Saved {
  format: number;
  welcomed: boolean;
  eased: string[];
  missed: string[];
  lessons: Record<string, Loose>;
  folders?: Record<string, string>;
}

export const FORMAT = 1;

// A work folder as the app saved it: an absolute path on one line.
const folder = (x: unknown, isAbsolute: (path: string) => boolean) =>
  typeof x === "string" &&
  x.length <= PATH_MAX &&
  isAbsolute(x) &&
  !/[\0\r\n]/.test(x)
    ? x
    : null;

const stepId = (x: unknown) =>
  typeof x === "string" && STEP_ID.test(x) ? x : null;

// The two fields ticket 213 added, still format 1, each only where it has
// something: the fingerprint the lesson was started under, and the help
// each finished step used, { stepId: { used, at } }.
const fingerprintOf = (x: unknown) =>
  typeof x === "string" && /^[0-9a-f]{64}$/.test(x) ? { fingerprint: x } : {};
function helpOf(x: unknown) {
  const help = Object.fromEntries(
    Object.entries(typeof x === "object" && x ? (x as Loose) : {})
      .filter((entry): entry is [string, { used: string; at: number }] => {
        const [k, v] = entry;
        return Boolean(
          stepId(k) &&
          typeof v === "object" &&
          v &&
          (HELP_USED as readonly unknown[]).includes((v as Loose).used) &&
          Number.isFinite((v as Loose).at) &&
          ((v as Loose).at as number) >= 0,
        );
      })
      .map(([k, v]) => [k, { used: v.used, at: v.at }]),
  );
  return Object.keys(help).length ? { help } : {};
}

// The check beat that passed at the saved place (ticket 314): its step,
// beat and the passing run's items, each item's words capped; nothing when
// any part is not what the app saves.
function passedCheckOf(x: unknown) {
  if (typeof x !== "object" || !x) return {};
  const v = x as Loose;
  const step = stepId(v.step);
  if (!step || !Number.isInteger(v.beat) || (v.beat as number) < 0) return {};
  if (!Array.isArray(v.items) || v.items.length > 64) return {};
  const items = [];
  for (const it of v.items as unknown[]) {
    const i = (typeof it === "object" && it ? it : {}) as Loose;
    if (
      !Number.isInteger(i.index) ||
      (i.index as number) < 0 ||
      typeof i.text !== "string" ||
      typeof i.pass !== "boolean"
    )
      return {};
    items.push({
      index: i.index,
      text: i.text.slice(0, 300),
      pass: i.pass,
      hint: typeof i.hint === "string" ? i.hint.slice(0, 300) : "",
      ...(i.slow === true ? { slow: true } : {}),
      ...(i.local === true ? { local: true } : {}),
    });
  }
  return { passedCheck: { step, beat: v.beat, items } };
}

// Keeps only what the app saves, so a hand-edited or newer file can't
// smuggle anything in.
export function sanitizeWith(
  input: unknown,
  isAbsolute: (path: string) => boolean,
): Saved {
  const data = input as Loose | null | undefined;
  const lessons: Record<string, Loose> = {};
  for (const [id, entry] of Object.entries((data?.lessons ?? {}) as Loose)) {
    if (
      !/^[a-z]-(\d+|capstone)$/.test(id) ||
      typeof entry !== "object" ||
      !entry
    )
      continue;
    const p = entry as Loose;
    lessons[id] = {
      step: typeof p.step === "string" ? p.step : null,
      beat: Number.isInteger(p.beat) && (p.beat as number) >= 0 ? p.beat : 0,
      done: Array.isArray(p.done)
        ? p.done.filter((x) => typeof x === "string")
        : [],
      answers: Object.fromEntries(
        Object.entries((p.answers ?? {}) as Loose)
          .filter(
            (e): e is [string, string] =>
              typeof e[0] === "string" && typeof e[1] === "string",
          )
          .map(([k, v]) => [k, v.slice(0, 200)]),
      ),
      levels: Array.isArray(p.levels)
        ? p.levels.filter((x: unknown) =>
            ["hinted", "challenge"].includes(x as string),
          )
        : [],
      lessHelp: p.lessHelp === true,
      // A file from before `moreHelpAt` saved `keepGuided`: it counts from the saved step.
      moreHelpAt:
        stepId(p.moreHelpAt) ?? (p.keepGuided === true ? stepId(p.step) : null),
      easedSteps: Object.fromEntries(
        Object.entries((p.easedSteps ?? {}) as Loose).filter(
          ([, v]) => v === true,
        ),
      ),
      complete: p.complete === true,
      warm: Array.isArray(p.warm)
        ? p.warm.filter((x) => typeof x === "string" && /^R\d+$/.test(x))
        : [],
      recalled: Array.isArray(p.recalled)
        ? p.recalled.filter((x) => typeof x === "string" && /^R\d+$/.test(x))
        : [],
      whileShown: Array.isArray(p.whileShown)
        ? p.whileShown.filter((x) => typeof x === "string" && /^R\d+$/.test(x))
        : [],
      stamps: Object.fromEntries(
        Object.entries((p.stamps ?? {}) as Loose)
          .filter(
            (e): e is [string, string] =>
              typeof e[0] === "string" && typeof e[1] === "string",
          )
          .map(([k, v]) => [k, v.slice(0, 120)]),
      ),
      bottomAt: stepId(p.bottomAt),
      ...fingerprintOf(p.fingerprint),
      ...helpOf(p.help),
      ...passedCheckOf(p.passedCheck),
    };
  }
  // The work folders the learner chose (ticket 86): one per later level and
  // per lesson that runs in a new copy, and nothing else. A file with none
  // has no key, as before the work folder.
  const saved = data?.folders as Loose | null | undefined;
  const folders = Object.fromEntries(
    FOLDER_KEYS.filter((k) => folder(saved?.[k], isAbsolute)).map((k) => [
      k,
      (saved as Loose)[k] as string,
    ]),
  );
  return {
    format: FORMAT,
    welcomed: data?.welcomed === true,
    eased: Array.isArray(data?.eased)
      ? data.eased.filter((x) => typeof x === "string")
      : [],
    missed: Array.isArray(data?.missed)
      ? data.missed.filter((x) => typeof x === "string")
      : [],
    lessons,
    ...(Object.keys(folders).length ? { folders } : {}),
  };
}

export const snapshotWith = (
  state: EngineState,
  isAbsolute: (path: string) => boolean,
) =>
  sanitizeWith(
    {
      welcomed: state.welcomed,
      eased: state.eased,
      missed: state.missed,
      lessons: state.progress,
      folders: state.folders,
    },
    isAbsolute,
  );
