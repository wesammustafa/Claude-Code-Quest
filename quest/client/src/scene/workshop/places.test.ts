// @vitest-environment node
// The workshop's places (D4): one per Level, in the Levels' order, holding
// a card for each of its Lessons, core ones first and then its labs, read
// from the Stations alone, for the default course (no labs) and Fix-It's.
import { describe, expect, test } from "vitest";
import type { LevelId } from "@quest/contract";
import type { SceneStation } from "../../mount/types";
import { placeOfLesson, workshopPlaces } from "./places";

const manifests = import.meta.glob<string>(
  [
    "../../../../../course/manifest.json",
    "../../../../../courses/fixit/course/manifest.json",
  ],
  { query: "?raw", import: "default", eager: true },
);

interface Manifest {
  lessons: { id: string; level: LevelId; order: number; optional?: boolean }[];
}

/** A course's Stations as the snapshot orders them, the Lessons in `done` complete. */
function stationsOf(path: string, done: readonly string[] = []) {
  const text = manifests[path];
  if (text === undefined) throw new Error(`no manifest at ${path}`);
  const { lessons } = JSON.parse(text) as Manifest;
  return [...lessons]
    .sort((a, b) => a.order - b.order)
    .map((l): SceneStation => ({
      lesson: l.id,
      level: l.level,
      optional: l.optional === true,
      complete: done.includes(l.id),
    }));
}

const DEFAULT = "../../../../../course/manifest.json";
const FIXIT = "../../../../../courses/fixit/course/manifest.json";

describe("the workshop's places", () => {
  test("the default course: a place per Level, in order, a card per Lesson, none optional", () => {
    const stations = stationsOf(DEFAULT, ["b-1"]);
    expect(stations).toHaveLength(23);
    const places = workshopPlaces(stations);
    expect(places.map((p) => [p.id, p.level])).toEqual([
      ["noticeboard", "beginner"],
      ["organizer", "intermediate"],
      ["release-desk", "advanced"],
    ]);
    expect(places.flatMap((p) => p.cards.map((c) => c.lesson))).toEqual(
      stations.map((s) => s.lesson),
    );
    expect(places.flatMap((p) => p.cards).some((c) => c.optional)).toBe(false);
    expect(places.map((p) => p.next)).toEqual(["b-2", "i-1", "a-1"]);
    expect(placeOfLesson(stations, "i-capstone")).toBe("organizer");
  });

  test("Fix-It: each Level's labs come after its core Lessons, and are next only once the core ones are done", () => {
    const stations = stationsOf(FIXIT);
    expect(stations).toHaveLength(26);
    const beginner = stations
      .filter((s) => s.level === "beginner")
      .map((s) => s.lesson);
    const core = stations
      .filter((s) => s.level === "beginner" && !s.optional)
      .map((s) => s.lesson);
    // Core Lessons first, then the labs, even with the Stations reversed.
    const noticeboard = workshopPlaces([...stations].reverse()).find(
      (p) => p.id === "noticeboard",
    );
    expect(noticeboard?.cards.map((c) => c.optional)).toEqual(
      beginner.map((_, i) => i >= core.length),
    );

    const places = (done: readonly string[]) =>
      workshopPlaces(stationsOf(FIXIT, done));
    const [first] = places([]);
    expect(first?.cards.filter((c) => c.optional).map((c) => c.lesson)).toEqual(
      ["b-3"],
    );
    expect(first?.next).toBe(core[0]);
    expect(places(core)[0]?.next).toBe("b-3");
    expect(places(beginner)[0]?.next).toBeNull();
    expect(placeOfLesson(stations, "a-5")).toBe("release-desk");
  });

  test("no Stations, no places; a Lesson the Stations do not hold has no place", () => {
    expect(workshopPlaces([])).toEqual([]);
    expect(placeOfLesson(stationsOf(DEFAULT), "x-1")).toBeNull();
  });
});
