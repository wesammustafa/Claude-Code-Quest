// Optional Lessons (labs): beside a Level's core path and outside its
// completion. A Learner can skip every lab and still complete each Level and
// the course, and the app never sends them to a lab while a core Lesson is
// left.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  NEW_COPY,
  course,
  driver,
  finished,
  playUntil,
  save,
  stepOf,
} from "./drive.mjs";
import { project } from "../src/project.ts";

// The course with `ids` as labs, each moved after its Level's capstone, as
// the Fix-It course places them.
function withLabs(...ids) {
  const labs = course
    .filter((l) => ids.includes(l.id))
    .map((l) => ({ ...l, optional: true }));
  return course
    .filter((l) => !ids.includes(l.id))
    .flatMap((l) =>
      l.id.endsWith("capstone")
        ? [l, ...labs.filter((lab) => lab.level === l.level)]
        : [l],
    );
}
const labbed = withLabs("b-3", "i-3", "a-1");
const LABS = ["b-3", "i-3", "a-1"];
// Every core Lesson of `levels` finished but `except`, and no lab.
const coreDone = (levels, ...except) =>
  Object.fromEntries(
    labbed
      .filter(
        (l) =>
          levels.includes(l.level) &&
          l.content &&
          !LABS.includes(l.id) &&
          !except.includes(l.id),
      )
      .map((l) => [l.id, finished(l)]),
  );
const ALL = ["beginner", "intermediate", "advanced"];

test("a Level's Lessons keep course order; the core ones are numbered on their own, a lab among the labs", () => {
  const s = project(driver({ course: labbed }).state);
  const beginner = s.course.levels[0].lessons;
  assert.deepEqual(
    beginner.map((l) => [l.id, l.number, l.optional]),
    [
      ["b-1", 1, false],
      ["b-2", 2, false],
      ["b-4", 3, false],
      ["b-5", 4, false],
      ["b-capstone", 5, false],
      ["b-3", 1, true],
    ],
  );
  assert.equal(s.course.next, "b-1");
});

test("a Level is complete with its core Lessons, its lab not done; next and the app's opening Lesson stay on the core path", () => {
  const d = driver({
    course: labbed,
    saved: save({ lessons: coreDone(["beginner"]) }),
  });
  const s = project(d.state);
  assert.equal(s.course.levels[0].complete, true);
  assert.equal(s.course.levels[0].lessons.at(-1).complete, false);
  assert.equal(s.course.next, "i-1");
  assert.equal(d.state.lesson, "i-1");
});

test("a Level of labs alone is not complete, with nothing done or every lab done", () => {
  // A course of part of the lineup: Beginner holds its labs and no core
  // Lesson, as a build of the Advanced labs alone once did.
  const labsOnly = labbed.filter(
    (l) => l.level !== "beginner" || l.id === "b-3",
  );
  const fresh = project(driver({ course: labsOnly }).state);
  assert.equal(fresh.course.levels[0].id, "beginner");
  assert.equal(fresh.course.levels[0].complete, false);
  const done = project(
    driver({
      course: labsOnly,
      saved: save({
        lessons: { "b-3": finished(course.find((l) => l.id === "b-3")) },
      }),
    }).state,
  );
  assert.equal(done.course.levels[0].lessons.at(-1).complete, true);
  assert.equal(done.course.levels[0].complete, false);
});

test("once every core Lesson is done, next is the first lab left", () => {
  const s = project(
    driver({ course: labbed, saved: save({ lessons: coreDone(ALL) }) }).state,
  );
  assert.ok(s.course.levels.every((l) => l.complete));
  assert.equal(s.course.next, "b-3");
});

test("level.completed and course.completed come with the core Lessons, every lab left undone; a lab's completion fires neither", () => {
  const level = driver({
    course: labbed,
    saved: save({ lessons: coreDone(["beginner"], "b-capstone") }),
  });
  level.open("b-capstone");
  playUntil(level, (s) => s.phase === "complete");
  assert.deepEqual(level.last.events.at(-1), {
    type: "level.completed",
    level: "beginner",
  });
  level.open("b-3");
  playUntil(level, (s) => s.phase === "complete");
  assert.deepEqual(level.last.events.at(-1), {
    type: "lesson.completed",
    badge: "Builder",
    capstone: false,
    firstTime: true,
  });

  const all = driver({
    course: labbed,
    saved: save({
      lessons: coreDone(ALL, "a-capstone"),
      folders: { "a-capstone": NEW_COPY },
    }),
  });
  all.open("a-capstone");
  playUntil(all, (s) => s.phase === "complete");
  assert.deepEqual(all.last.events.slice(-2), [
    { type: "level.completed", level: "advanced" },
    { type: "course.completed" },
  ]);
});

test("a capstone's Same skills as earlier lessons asks for no lab before it", () => {
  // b-3 a lab in its place, before the capstone, and never played.
  const inPlace = course.map((l) =>
    l.id === "b-3" ? { ...l, optional: true } : l,
  );
  const d = driver({
    course: inPlace,
    saved: save({
      lessons: {
        ...coreDone(["beginner"], "b-capstone"),
        "b-capstone": { step: "T2", beat: 0, done: ["T1"] },
      },
    }),
  });
  d.open("b-capstone");
  assert.equal(stepOf(d.state).id, "T2");
  assert.equal(project(d.state).lesson.step.doneBefore, true);
});
