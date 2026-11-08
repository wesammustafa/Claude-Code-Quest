// The learner's place, saved in `.practice/learn.json` of the practice copy:
// git ignores `.practice/`, and every check that reads git status leaves it
// out. It is the only file the app writes, and only once `.practice/` exists.
import {
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join } from "node:path";
import type { EngineState } from "@quest/engine";
import {
  FORMAT,
  sanitizeWith,
  snapshotWith,
  type Saved,
} from "./save-shape.ts";

export { FORMAT, type Saved };

// JSON as the file holds it, read field by field.
type Loose = Record<string, unknown>;

const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

export const storePath = (root: string) =>
  join(root, ".practice", "learn.json");

// The saved file, sanitized; null where there is none. A file the app
// can't read (not JSON, not an object, another format, or no file at all
// but a folder) is moved aside, never overwritten (ticket 213), and the
// load gives a marker with no lessons, so the app starts fresh and says so
// once: `{unreadable: "moved"}`, or `{unreadable: "kept"}` where the move
// failed and the file stays where it is.
export function loadState(
  root: string,
): Saved | null | { unreadable: "moved" | "kept" } {
  const file = storePath(root);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    // No file, or a root `.practice` that is a file: no save yet.
    if (code(error) === "ENOENT" || code(error) === "ENOTDIR") return null;
    return { unreadable: moveAside(file) ? "moved" : "kept" };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    Array.isArray(data) ||
    (data as Loose).format !== FORMAT
  )
    return { unreadable: moveAside(file) ? "moved" : "kept" };
  return sanitize(data);
}

// Moves the file to the first free name of `learn.json.unreadable`,
// `learn.json.unreadable-2` and on to `-99`, never over a file there: a
// hard link fails where the name is taken (EEXIST), and so does the copy
// made where links are not allowed. A `learn.json` that is a folder is
// renamed after a look. True where the file left its place.
function moveAside(file: string): boolean {
  let folder: boolean;
  try {
    folder = statSync(file).isDirectory();
  } catch {
    return false;
  }
  for (let n = 1; n <= 99; n++) {
    const target = `${file}.unreadable${n === 1 ? "" : `-${String(n)}`}`;
    try {
      if (folder) {
        if (existsSync(target)) continue;
        renameSync(file, target);
        return true;
      }
      try {
        linkSync(file, target);
      } catch (error) {
        if (!["EPERM", "ENOTSUP", "EXDEV"].includes(code(error) ?? ""))
          throw error;
        copyFileSync(file, target, constants.COPYFILE_EXCL);
      }
      rmSync(file);
      return true;
    } catch (error) {
      if (code(error) !== "EEXIST") return false;
    }
  }
  return false;
}

// What the store keeps (save-shape.ts), with this platform's isAbsolute.
export const sanitize = (input: unknown): Saved =>
  sanitizeWith(input, isAbsolute);
export const snapshot = (state: EngineState) => snapshotWith(state, isAbsolute);

// Makes root `.practice/` on the first start (ticket 277): the template
// ships no empty folder. A copy where it can't be made saves nothing.
export function preparePractice(root: string) {
  try {
    mkdirSync(join(root, ".practice"), { recursive: true });
  } catch {
    // Read-only or not ours: the snapshot's saving says so.
  }
}

// Writes atomically. Returns false, writing nothing, while `.practice/` is missing.
export function saveState(root: string, data: object): boolean {
  if (!existsSync(join(root, ".practice"))) return false;
  const file = storePath(root);
  const tmp = `${file}.${String(process.pid)}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 1)}\n`);
  try {
    renameSync(tmp, file);
  } catch (error) {
    // Windows: another program (an editor, antivirus) may hold the file a moment.
    if (!["EPERM", "EBUSY", "EACCES"].includes(code(error) ?? "")) throw error;
    try {
      renameSync(tmp, file);
    } catch (again) {
      rmSync(tmp, { force: true });
      throw again;
    }
  }
  return true;
}
