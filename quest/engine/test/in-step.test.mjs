// The engine's in-Step state (seam S5): what it keeps only in memory about
// the unfinished Step, as inStepOf gives it and initialState({ inStep })
// takes it back after a restart, and the Not-yet streak it counts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { inStepOf, project } from "../src/index.ts";
import {
  b1Only,
  beatOf,
  checkError,
  checkResult,
  driver,
  FACTS,
  gitResult,
  initialState,
  reduce,
  save,
  stepOf,
} from "./drive.mjs";

const b1 = b1Only.find((l) => l.id === "b-1");
const ITEM = b1.items[0];
const fail = (hint = "No `.practice/version.txt` yet.") => [
  { index: 0, text: ITEM, pass: false, hint },
];
const pass = () => [{ index: 0, text: ITEM, pass: true, hint: "" }];
const before = (id) =>
  b1.content.steps.slice(
    0,
    b1.content.steps.findIndex((x) => x.id === id),
  );
const savedAt = (step, beat = 0, more = {}) =>
  save({
    lessons: {
      "b-1": {
        step,
        beat,
        done: before(step).map((x) => x.id),
        ...more,
      },
    },
  });
const lastEffect = (d, type) => d.last.effects.find((e) => e.type === type);

// b-1's W3 open, a Not yet on screen (its first answer, then Check again),
// and a hint opened.
function notYetAtW3() {
  const d = driver({ saved: savedAt("W3") });
  d.open("b-1");
  d.send(checkResult(lastEffect(d, "check"), fail()));
  d.run();
  d.send(checkResult(lastEffect(d, "check"), fail()));
  d.hint();
  return d;
}

// The save the engine's state would write, as a store keeps it.
const saveOf = (s) =>
  save({ lessons: structuredClone(s.progress), eased: s.eased });
// A restart: a new state from that save and the in-Step state.
const restart = (s, inStep = inStepOf(s), saved = saveOf(s)) =>
  initialState({ course: b1Only, saved, facts: FACTS, now: 1_000, inStep });
const reduced = (s, input) => reduce(s, { now: 1_000, ...input });

test("inStepOf holds the open Lesson's help, the beat's rung, confirm, unlock, Not yet and streak, and the Step-down on screen", () => {
  const d = notYetAtW3();
  assert.deepEqual(inStepOf(d.state), {
    v: 1,
    lesson: "b-1",
    help: { W3: "hints" },
    at: {
      step: "W3",
      beat: 0,
      rung: 0,
      confirm: false,
      unlocked: true,
      notYets: 1,
      fail: { item: ITEM, hint: "No `.practice/version.txt` yet." },
      items: null,
    },
    stepDown: null,
  });
  // A Step-down on screen: no beat, its levels.
  const w7 = driver({ saved: savedAt("W7", 2) });
  w7.open("b-1");
  w7.send(gitResult(lastEffect(w7, "git")));
  w7.cont();
  assert.equal(w7.state.phase, "step-down");
  assert.deepEqual(inStepOf(w7.state).stepDown, {
    step: "Y1",
    from: "guided",
    to: "hinted",
  });
  assert.equal(inStepOf(w7.state).at, null);
});

test("initialState({ inStep }) restores the rung, the streak, the help and the Not yet on the beat it was taken on", () => {
  const d = notYetAtW3();
  const was = project(d.state).lesson;
  const s = restart(d.state);
  assert.deepEqual(s.stepHelp, { "b-1 W3": "hints" });
  const opened = reduced(s, { type: "lesson.open", lesson: "b-1" });
  const now = project(opened.state).lesson;
  assert.deepEqual(now.hints, was.hints);
  assert.equal(now.beat.fail, was.beat.fail);
  assert.equal(now.beat.status, "fail");
  assert.equal(opened.state.beat.notYets, 1);
  assert.equal(opened.state.resume, undefined, "taken");
  // The arrival run repeats the same FAIL: no new Not yet, the rung stays.
  const arrival = opened.effects.find((e) => e.type === "check");
  const r = reduced(opened.state, checkResult(arrival, fail()));
  assert.deepEqual(
    r.events.filter((e) => e.type === "check.notYet"),
    [],
  );
  assert.equal(r.state.beat.rung, 0);
  assert.deepEqual(project(r.state).lesson.hints, was.hints);
  // Another FAIL is a real Not yet, and starts the ladder again.
  const other = reduced(
    r.state,
    checkResult(arrival, fail("Not the version.")),
  );
  assert.equal(other.events.filter((e) => e.type === "check.notYet").length, 1);
  assert.equal(other.state.beat.notYets, 2);
});

test("help opened before a restart counts when the Step finishes: Mastery never undercounts", () => {
  // Y4, at Challenge: only the hint opened makes it "hints".
  const d = driver({ saved: savedAt("Y4") });
  d.open("b-1");
  if (beatOf(d.state).doneLabel) d.ended();
  else d.run();
  const git = d.effects.findLast((e) => e.type === "git");
  d.send(gitResult(git, { paths: ["?? stray.txt"] }));
  assert.equal(d.state.beat.status, "fail");
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  const finishAfter = (s) => {
    let r = reduced(s, { type: "lesson.open", lesson: "b-1" });
    if (beatOf(r.state).doneLabel)
      r = reduced(r.state, { type: "session.ended" });
    const look = r.effects.findLast((e) => e.type === "git");
    r = reduced(r.state, gitResult(look));
    assert.equal(r.state.beat.status, "done");
    return reduced(r.state, { type: "step.continue" }).state;
  };
  const kept = finishAfter(restart(d.state));
  assert.equal(kept.progress["b-1"].help.Y4.used, "hints");
  const lost = finishAfter(restart(d.state, null));
  assert.equal(
    lost.progress["b-1"].help.Y4.used,
    "own",
    "without the in-Step state the hint would not count",
  );
});

test("a Step-down on screen comes back as the Step-down after a restart", () => {
  const d = driver({ saved: savedAt("W7", 2) });
  d.open("b-1");
  d.send(gitResult(lastEffect(d, "git")));
  d.cont();
  assert.equal(d.state.phase, "step-down");
  const s = restart(d.state);
  const plain = reduced(restart(d.state, null), {
    type: "lesson.open",
    lesson: "b-1",
  });
  assert.equal(plain.state.phase, "playing", "without it, Y1 opens at once");
  const r = reduced(s, { type: "lesson.open", lesson: "b-1" });
  assert.equal(r.state.phase, "step-down");
  assert.equal(stepOf(r.state).id, "Y1");
  assert.deepEqual(project(r.state).lesson, project(d.state).lesson);
  assert.deepEqual(
    r.events,
    [{ type: "stepDown.reached", from: "guided", to: "hinted" }],
    "a moment not taken yet is reached again on the new screen",
  );
  const on = reduced(r.state, { type: "stepDown.accept" });
  assert.equal(on.state.phase, "playing");
  assert.ok(on.state.progress["b-1"].levels.includes("hinted"));
});

test("inStep for another beat, a changed Lesson, a bad version or a new play is dropped", () => {
  const d = notYetAtW3();
  const inStep = inStepOf(d.state);
  const plain = restart(d.state, null);
  // Another beat: the save is at W4.
  const w4 = initialState({
    course: b1Only,
    saved: savedAt("W4"),
    facts: FACTS,
    now: 1_000,
    inStep,
  });
  const atW4 = reduced(w4, { type: "lesson.open", lesson: "b-1" }).state;
  assert.equal(stepOf(atW4).id, "W4");
  assert.equal(atW4.beat.rung, -1);
  assert.equal(atW4.beat.notYets, undefined);
  assert.equal(atW4.resume, undefined);
  // A changed Lesson: its play starts again.
  const changed = saveOf(d.state);
  changed.lessons["b-1"].fingerprint = "0".repeat(64);
  assert.deepEqual(
    restart(d.state, inStep, changed),
    restart(d.state, null, changed),
  );
  // Another version, or a lesson the course lacks.
  assert.deepEqual(restart(d.state, { ...inStep, v: 2 }), plain);
  assert.deepEqual(restart(d.state, { ...inStep, lesson: "b-9" }), plain);
  // A new play: the restart's state goes with it.
  const s = restart(d.state, inStep);
  const again = reduced(s, { type: "lesson.restart", lesson: "b-1" }).state;
  assert.equal(again.resume, undefined);
  assert.deepEqual(again.stepHelp, {});
});

test("without inStep, initialState is as before", () => {
  const d = notYetAtW3();
  const args = {
    course: b1Only,
    saved: saveOf(d.state),
    facts: FACTS,
    now: 1_000,
  };
  const plain = initialState(args);
  assert.deepEqual(initialState({ ...args, inStep: null }), plain);
  assert.deepEqual(initialState({ ...args, inStep: undefined }), plain);
  assert.equal("resume" in plain, false);
});

test("the Not-yet streak counts each Not yet in a row, a broken Check leaves it, and a new beat starts at 0", () => {
  const d = driver({ saved: savedAt("W3") });
  d.open("b-1");
  const arrival = lastEffect(d, "check");
  d.send(checkResult(arrival, fail()));
  assert.equal(d.state.beat.notYets, undefined, "the first answer is none");
  d.run();
  d.send(checkResult(lastEffect(d, "check"), fail()));
  assert.equal(d.state.beat.notYets, 1);
  d.send(checkResult(arrival, fail("Not the version.")));
  assert.equal(d.state.beat.notYets, 2);
  d.send(checkError(arrival, "it took too long"));
  assert.equal(d.state.beat.status, "broken");
  assert.equal(d.state.beat.notYets, 2, "a broken Check leaves the row");
  d.send(checkResult(arrival, fail("Still not the version.")));
  assert.equal(d.state.beat.notYets, 3);
  d.send(checkResult(arrival, pass()));
  d.cont();
  assert.equal(stepOf(d.state).id, "W4");
  assert.equal(d.state.beat.notYets, undefined, "a new beat starts again");
});
