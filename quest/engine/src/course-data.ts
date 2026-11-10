// The course data a browser can load (seam S2): the manifest's path and
// levels and courseFrom, which builds the course from a compiled course.
// It imports neither node:fs nor the Check modules, so a page bundle can
// take it. course.ts adds the Node-only parts (loadCourse, parseLesson) and
// the Check modules' titles.
import manifestJson from "../../../course/manifest.json" with { type: "json" };
import {
  coursePath,
  folderKeys,
  indexLevel as manifestIndexLevel,
  must,
  workLevels,
  type CompiledCourse,
  type CompiledLesson,
  type LessonContent,
  type Manifest,
} from "./content.ts";
import type { CourseEntry, PathEntry } from "./types.ts";

// The manifest as course/manifest.json holds it, read as it is: the course
// compile step checks it.
const manifest = manifestJson as Manifest;

export const PATH: PathEntry[] = coursePath(manifest).map((entry) => ({
  id: entry.id,
  level: entry.level,
  page: entry.page,
  ...(entry.folder === "copy" && entry.level !== "beginner"
    ? { folder: "copy" as const }
    : {}),
  ...(entry.folder === "new-copy" ? { newCopy: true as const } : {}),
  // A lesson of a level that practises in a work folder (the engine's
  // levelKey reads it, so engine.ts imports no file-reading module).
  ...(entry.folder === "work" ? { work: true as const } : {}),
}));
export const LEVELS = manifest.levels.map((level) => level.id);
export const WORK_LEVELS = workLevels(manifest);
export const FOLDER_KEYS = folderKeys(manifest);
export const SLOW: Readonly<Record<string, number[]>> = Object.fromEntries(
  coursePath(manifest)
    .filter((lesson) => lesson.slow.length)
    .map((lesson) => [lesson.id, lesson.slow]),
);
export const indexLevel = (id: string) => manifestIndexLevel(manifest, id);

/** Each Lesson's Check title, by Lesson id: the Check modules' `title`. */
export type CheckTitles = Readonly<Record<string, string | undefined>>;

// One course entry: its path entry, the compiled lesson's page fields and
// its content. A Lesson the compiled course lacks, a requirement on no
// lesson before it here, and worked: copy where every step runs in a copy
// are errors.
export function entryOf(
  entry: PathEntry,
  at: number,
  path: readonly PathEntry[],
  byId: ReadonlyMap<string, CompiledLesson>,
  contentOf: (lesson: CompiledLesson) => LessonContent | null,
  compiled: boolean,
  titles: CheckTitles,
): CourseEntry {
  const lesson = byId.get(entry.id);
  if (!lesson)
    throw new Error(`course/manifest.json:1: unknown Lesson ${entry.id}`);
  const content = contentOf(lesson);
  const late = content?.requires.find(
    (requirement) =>
      requirement.lesson &&
      !path.slice(0, at).some((previous) => previous.id === requirement.lesson),
  );
  if (late)
    throw new Error(
      `learn/lessons/${entry.id}.md: requires ${String(late.lesson)}, no lesson before ${entry.id} here`,
    );
  if (content?.worked && !content.folder && (entry.folder || entry.newCopy))
    throw new Error(
      `learn/lessons/${entry.id}.md: worked: copy, but ${entry.id} runs every step in ${entry.newCopy ? "its new copy" : "the practice copy"}`,
    );
  // The page's time estimate goes right after its page, where the path
  // entry held it before ticket 214.
  const { id, level, page, ...pins } = entry;
  return {
    id,
    level,
    page,
    minutes: lesson.minutes,
    ...pins,
    title: must(
      titles[entry.id],
      `course/manifest.json:1: no Check module for ${entry.id}`,
    ),
    url: lesson.url,
    items: lesson.items,
    slow: lesson.slow,
    content,
    // The course file's fingerprints, which the engine compares a save
    // with (ticket 213); a step file read on its own has none.
    ...(compiled && {
      fingerprint: lesson.fingerprint,
      legacyFingerprint: lesson.legacyFingerprint,
    }),
    ...(lesson.judged && { judged: lesson.judged }),
  };
}

// The course from a compiled course (dist/course.json's contents), with
// its fingerprints and the Check modules' titles. Pure: it reads no file.
export function courseFrom(
  compiled: CompiledCourse,
  titles: CheckTitles,
  path: readonly PathEntry[] = PATH,
): CourseEntry[] {
  const byId = new Map(compiled.lessons.map((lesson) => [lesson.id, lesson]));
  return path.map((entry, at) =>
    entryOf(
      entry,
      at,
      path,
      byId,
      (lesson) => ({
        ...lesson.content,
        title: lesson.title,
        next: lesson.next,
        page: lesson.url,
      }),
      true,
      titles,
    ),
  );
}
