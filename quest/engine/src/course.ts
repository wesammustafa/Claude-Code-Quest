// The course as the engine reads it (ticket 210): the manifest's path and
// levels, the compiled course (dist/course.json, from npm run
// course:compile), and the pure step-file parser bound to the manifest and
// the Checks. The pure parser is content.ts; the browser-safe course data
// is course-data.ts (seam S2). courseFrom builds the course from a compiled
// course it is given; loadCourse reads dist/course.json on its first call.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import manifestJson from "../../../course/manifest.json" with { type: "json" };
import {
  parseLesson as parseContent,
  type CheckModule,
  type CompiledCourse,
  type Manifest,
} from "./content.ts";
import {
  courseFrom as courseFromData,
  entryOf,
  PATH,
  type CheckTitles,
} from "./course-data.ts";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "./probes.ts";
import type { CourseEntry, PathEntry } from "./types.ts";

export {
  FOLDER_KEYS,
  indexLevel,
  LEVELS,
  PATH,
  SLOW,
  WORK_LEVELS,
} from "./course-data.ts";

const manifest = manifestJson as Manifest;
const checks: Readonly<Record<string, CheckModule | undefined>> = lessons;
const titles: CheckTitles = Object.fromEntries(
  Object.entries(checks).map(([id, check]) => [id, check?.title]),
);

export function parseLesson(text: string, file = "lesson") {
  return parseContent(text, file, {
    manifest,
    checks,
    probes: { PROBES, probeError },
  });
}

// The course from a compiled course (dist/course.json's contents), with
// its fingerprints. Pure: it reads no file.
export function courseFrom(
  compiled: CompiledCourse,
  path: readonly PathEntry[] = PATH,
): CourseEntry[] {
  return courseFromData(compiled, titles, path);
}

// The compiled course, read once, on the first loadCourse.
let compiledCourse: CompiledCourse | undefined;

// The course for a practice root: the template's own is the compiled
// course; any other reads each lesson's step file from its learn/lessons/,
// with no fingerprints, or none where it has no file. Only tests read a step
// file on its own, and its links stay as written: compileCourse resolves
// them (resolveLinks), and the app reads the compiled course.
export function loadCourse(
  root: string,
  path: readonly PathEntry[] = PATH,
): CourseEntry[] {
  compiledCourse ??= JSON.parse(
    readFileSync(new URL("../dist/course.json", import.meta.url), "utf8"),
  ) as CompiledCourse;
  const useCompiled =
    resolve(root) ===
    resolve(new URL("../../../practice-template", import.meta.url).pathname);
  if (useCompiled) return courseFrom(compiledCourse, path);
  const byId = new Map(
    compiledCourse.lessons.map((lesson) => [lesson.id, lesson]),
  );
  return path.map((entry, at) =>
    entryOf(
      entry,
      at,
      path,
      byId,
      () => {
        const file = join(root, "learn", "lessons", `${entry.id}.md`);
        return existsSync(file)
          ? parseLesson(
              readFileSync(file, "utf8"),
              `learn/lessons/${entry.id}.md`,
            )
          : null;
      },
      false,
      titles,
    ),
  );
}
