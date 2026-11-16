import { test } from "vitest";
import assert from "node:assert/strict";
import { driver, save, stepOf } from "./drive.mjs";
import { project } from "../src/project.ts";

function at(step, done, extra = {}) {
  const d = driver({
    saved: save({
      lessons: {
        "b-1": { step, beat: 0, done, ...extra },
      },
    }),
  });
  d.open("b-1");
  return d;
}

test("step.visit opens an earlier step and keeps every done tick", () => {
  const d = at("W3", ["W1", "W2"]);
  d.act("step.visit", { step: "W1" });
  assert.equal(stepOf(d.state).id, "W1");
  assert.deepEqual(d.state.progress["b-1"].done, ["W1", "W2"]);
});

test("step.visit opens a completed step after the current one", () => {
  const d = at("W3", ["W1", "W2"]);
  d.act("step.visit", { step: "W1" });
  d.act("step.visit", { step: "W2" });
  assert.equal(stepOf(d.state).id, "W2");
  assert.deepEqual(d.state.progress["b-1"].done, ["W1", "W2"]);
});

test("step.visit refuses an unfinished future step", () => {
  const d = at("W3", ["W1", "W2"]);
  const before = { ...d.state.pos };
  d.refused("step.visit", { step: "W4" });
  assert.deepEqual(d.state.pos, before);
});

test("step.visit advances past a completed current step", () => {
  const d = at("W3", ["W1", "W2"], {
    passedCheck: {
      step: "W3",
      beat: 0,
      items: [{ index: 1, text: "x", pass: true, hint: "" }],
    },
  });
  assert.equal(d.state.beat.status, "done");
  d.act("step.visit", { step: "W4" });
  assert.equal(stepOf(d.state).id, "W4");
  assert.deepEqual(d.state.progress["b-1"].done, ["W1", "W2", "W3"]);
});

test("step.visit advances from a revisited completed step to its unfinished successor", () => {
  const d = at("W3", ["W1"]);
  d.act("step.visit", { step: "W1" });
  assert.equal(project(d.state).lesson.steps[0]?.state, "done");
  d.act("step.visit", { step: "W2" });
  assert.equal(stepOf(d.state).id, "W2");
});
