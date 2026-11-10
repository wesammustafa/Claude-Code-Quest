// Host-judged beats (seam S6): a beat a course entry marks `judge: "host"`
// runs no verify of its own; the host's `judged` verdict decides it, read
// as a Check result, with the mark's static ladder as its hints.
import { readFileSync } from "node:fs";
import { test } from "vitest";
import assert from "node:assert/strict";
import { courseFrom } from "../src/course-data.ts";
import { inStepOf, project } from "../src/index.ts";
import {
  b1Only,
  keyOf,
  driver,
  FACTS,
  gitResult,
  hintAvailable,
  initialState,
  liveCourse,
  reduce,
  save,
  stepOf,
  watching,
} from "./drive.mjs";

const b1 = b1Only.find((l) => l.id === "b-1");
const LADDER = [
  { kind: "hint", text: "Say which file the version goes in." },
  {
    kind: "choice",
    legend: "Which prompt would you send?",
    unlockAfterNotYets: 2,
    options: [
      { text: "Save the version to notes.md", kind: "right", because: "a" },
      { text: "Tell me the version", kind: "wrong", because: "b" },
      { text: "Fix it", kind: "wrong", because: "c" },
    ],
  },
  { kind: "exact", text: "Save the output of claude --version to notes.md" },
];
// Y4, a git-clean beat at Challenge, marked for the host to judge.
const MARK = { judge: "host", ladder: LADDER };
const judgedCourse = b1Only.map((l) =>
  l.id === "b-1" ? { ...l, judged: { "Y4.0": MARK } } : l,
);
const done = b1.content.steps.slice(0, -2).map((x) => x.id);
const AT_Y4 = save({ lessons: { "b-1": { step: "Y4", beat: 0, done } } });

const ITEMS = (passes = [false, true], hint = "Name the file.") => [
  { index: 0, text: "Names the file", pass: passes[0], hint },
  { index: 1, text: "Asks for the version", pass: passes[1], hint: "" },
];
function atY4(saved = AT_Y4) {
  const d = driver({ saved, course: judgedCourse });
  d.open("b-1");
  return d;
}
const verdict = (d, fields = {}) =>
  d.send({
    type: "judged",
    beat: keyOf(d.state),
    pass: false,
    items: ITEMS(),
    done: false,
    ...fields,
  });
const notYets = (events) => events.filter((e) => e.type === "check.notYet");

test("a judged miss shows the engine's Check bubble and lines and emits check.notYet", () => {
  const d = atY4();
  verdict(d);
  const beat = project(d.state).lesson.beat;
  assert.equal(beat.decidedBy, "check");
  assert.equal(beat.status, "fail");
  assert.deepEqual(beat.verification, [
    { text: "Names the file", pass: false },
    { text: "Asks for the version", pass: true },
  ]);
  assert.equal(beat.fail, "Name the file.");
  assert.deepEqual(notYets(d.last.events), [
    { type: "check.notYet", evidence: "Name the file." },
  ]);
  assert.deepEqual(d.last.effects, [{ type: "save" }]);
});

test("the same judged miss twice emits check.notYet twice and the streak is 2", () => {
  const d = atY4();
  verdict(d);
  verdict(d);
  assert.equal(notYets(d.events).length, 2);
  assert.equal(d.state.beat.notYets, 2);
});

test("the choice rung unlocks only after 2 Not yets in a row", () => {
  const d = atY4();
  assert.equal(hintAvailable(d.state), false, "Challenge: a try first");
  verdict(d);
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  assert.equal(hintAvailable(d.state), false, "1 Not yet: the choice waits");
  d.refused("hint.next");
  verdict(d);
  assert.equal(hintAvailable(d.state), true);
  d.hint();
  assert.deepEqual(project(d.state).lesson.hints.shown, [
    { kind: "quote", text: LADDER[0].text },
    {
      kind: "choice",
      legend: LADDER[1].legend,
      options: LADDER[1].options,
    },
  ]);
  d.hint();
  assert.equal(d.state.beat.confirm, true, "the exact text behind its y/n");
});

test("a judged miss never resets the rung: the ladder is static", () => {
  const d = atY4();
  verdict(d);
  d.hint();
  verdict(d, { items: ITEMS([true, false], "Ask for the version.") });
  assert.equal(d.state.beat.rung, 0);
  assert.equal(project(d.state).lesson.beat.fail, "");
  verdict(d, { items: ITEMS([false, false], "Other words.") });
  assert.equal(d.state.beat.rung, 0);
  assert.equal(project(d.state).lesson.beat.fail, "Other words.");
});

test("done: true passes the beat, emits check.passed and step.continue goes on", () => {
  const d = atY4();
  verdict(d);
  verdict(d, {
    pass: true,
    done: true,
    items: ITEMS([true, true]),
    note: "A bonus: name the folder too.",
  });
  const beat = project(d.state).lesson.beat;
  assert.equal(beat.status, "done");
  assert.equal(beat.note, "A bonus: name the folder too.");
  assert.deepEqual(
    beat.verification.map((v) => v.pass),
    [true, true],
  );
  assert.deepEqual(
    d.last.events.map((e) => e.type),
    ["check.passed", "step.completed"],
  );
  d.cont();
  assert.equal(stepOf(d.state).id, "C");
});

test("a judged pass with done: false clears the Not yet and the streak and leaves the beat open", () => {
  const d = atY4();
  verdict(d);
  assert.equal(d.state.beat.notYets, 1);
  verdict(d, { pass: true, items: ITEMS([true, true]) });
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(d.state.beat.fail, null);
  assert.equal(d.state.beat.notYets, 0);
  assert.deepEqual(d.last.events, []);
  assert.deepEqual(
    project(d.state).lesson.beat.verification.map((v) => v.pass),
    [true, true],
  );
  d.refused("step.continue");
});

test("Mastery counts hint.next as With hints and hint.takeExact as Every command shown on a judged beat", () => {
  const passAndFinish = (d) => {
    verdict(d, { pass: true, done: true, items: ITEMS([true, true]) });
    d.cont();
    return d.state.progress["b-1"];
  };
  const hints = atY4();
  verdict(hints);
  hints.hint();
  assert.equal(passAndFinish(hints).help.Y4.used, "hints");
  const exact = atY4();
  verdict(exact);
  exact.hint();
  verdict(exact);
  exact.hint();
  exact.hint();
  exact.exact(true);
  assert.equal(exact.state.beat.rung, 2);
  assert.ok(exact.state.eased.includes(stepOf(exact.state).skill));
  const p = passAndFinish(exact);
  assert.equal(p.bottomAt, "Y4");
  assert.equal(p.help.Y4.used, "commands");
  const own = atY4();
  assert.equal(passAndFinish(own).help.Y4.used, "own");
});

test("a judged input for a beat not on the card, an unmarked beat or a done beat changes nothing", () => {
  const d = atY4();
  const refused = (fields) => {
    verdict(d, fields);
    assert.equal(d.last.changed, false);
    assert.deepEqual(d.last.effects, []);
    assert.deepEqual(d.last.events, []);
  };
  refused({ beat: "b-1:Y3:0" });
  refused({ beat: "b-2:Y4:0" });
  // An unmarked beat: W3 in the same course.
  const w3 = driver({
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
    course: judgedCourse,
  });
  w3.open("b-1");
  w3.send({
    type: "judged",
    beat: keyOf(w3.state),
    pass: true,
    items: ITEMS([true, true]),
    done: true,
  });
  assert.equal(w3.last.changed, false);
  verdict(d, { pass: true, done: true, items: ITEMS([true, true]) });
  refused({});
});

test("a host-judged beat runs no Check, watches nothing, refuses step.markDone, and engine results do not decide it", () => {
  const d = atY4();
  assert.deepEqual(d.last.effects, [{ type: "save" }]);
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(watching(d.state), null);
  d.refused("step.markDone");
  d.refused("session.ended");
  d.refused("check.run", { beat: keyOf(d.state) });
  d.send(gitResult({ dir: FACTS.root + "/project" }));
  assert.equal(d.state.beat.status, "waiting");
  // Unmarked, the same beat watches git and opens with a look.
  const plain = driver({ saved: AT_Y4 });
  plain.open("b-1");
  assert.notEqual(watching(plain.state), null);
});

test("courseFrom carries a compiled lesson's judged marks into its CourseEntry", () => {
  const compiled = JSON.parse(
    readFileSync(new URL("../dist/course.json", import.meta.url), "utf8"),
  );
  const titles = Object.fromEntries(liveCourse.map((l) => [l.id, l.title]));
  compiled.lessons.find((l) => l.id === "b-1").judged = { "Y4.0": MARK };
  const entries = courseFrom(compiled, titles);
  assert.deepEqual(entries.find((l) => l.id === "b-1").judged, {
    "Y4.0": MARK,
  });
  assert.equal("judged" in entries.find((l) => l.id === "b-2"), false);
});

test("a passed judged beat stays passed after a reopen", () => {
  const d = atY4();
  verdict(d, { pass: true, done: true, items: ITEMS([true, true]) });
  const saved = save({ lessons: structuredClone(d.state.progress) });
  const s = initialState({
    course: judgedCourse,
    saved,
    facts: FACTS,
    now: 1_000,
  });
  const r = reduce(s, { type: "lesson.open", lesson: "b-1", now: 1_000 });
  const beat = project(r.state).lesson.beat;
  assert.equal(beat.status, "done");
  assert.deepEqual(
    beat.verification.map((v) => v.pass),
    [true, true],
  );
});

test("a judged miss comes back after a restart with its lines, rung and streak", () => {
  const d = atY4();
  verdict(d);
  d.hint();
  const was = project(d.state).lesson;
  const s = initialState({
    course: judgedCourse,
    saved: save({ lessons: structuredClone(d.state.progress) }),
    facts: FACTS,
    now: 1_000,
    inStep: inStepOf(d.state),
  });
  const r = reduce(s, { type: "lesson.open", lesson: "b-1", now: 1_000 });
  const now = project(r.state).lesson;
  assert.deepEqual(now.beat.verification, was.beat.verification);
  assert.equal(now.beat.fail, was.beat.fail);
  assert.deepEqual(now.hints, was.hints);
  assert.equal(r.state.beat.notYets, 1);
});
