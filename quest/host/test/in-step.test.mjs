// The host's in-Step state (seam S5) and host-judged verdicts (seam S6):
// Host.inStep() gives the engine's in-Step state and the pending
// milestones as the save being written should hold them, a new host takes
// them back on create, and Host.judged reduces a verdict no client can send.
import { test } from "vitest";
import assert from "node:assert/strict";
import { initialState, reduce } from "../src/engine.ts";
import { b1Only } from "../../engine/test/drive.mjs";
import { AT_W3, checkRun, fakeHost, turn, typesOf, w3 } from "./scripted.mjs";

const b1 = b1Only.find((l) => l.id === "b-1");
// b-1 saved at its last beat, a self beat: one step.markDone finishes it.
const AT_END = {
  format: 1,
  welcomed: true,
  lessons: {
    "b-1": {
      step: "C",
      beat: 2,
      done: b1.content.steps.map((x) => x.id).filter((id) => id !== "C"),
    },
  },
};
const COMPLETED = {
  type: "lesson.completed",
  ...(b1.content.badge ? { badge: b1.content.badge } : {}),
  capstone: false,
  firstTime: true,
};
const milestoneTypes = (host) => host.snapshot().milestones.map((m) => m.type);

// A host that finished b-1, replayed it to W3, got a Not yet there and
// opened a hint. Its checks answer FAIL.
async function replayedToW3() {
  const h = fakeHost({
    instance: "a",
    saved: AT_END,
    checks: () => w3(false),
  });
  const { host } = h;
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  host.dispatch({ type: "step.markDone" });
  assert.deepEqual(milestoneTypes(host), ["lesson.completed"]);
  host.dispatch({ type: "lesson.restart", lesson: "b-1" });
  host.dispatch({ type: "lesson.start", help: "planned" });
  host.dispatch({ type: "step.markDone" });
  const w2 = b1.content.steps.find((x) => x.id === "W2").beats[0];
  host.dispatch({
    type: "answer.pick",
    option: w2.options.findIndex((o) => o.kind === "right"),
  });
  host.dispatch({ type: "step.continue" });
  await turn();
  assert.equal(host.snapshot().lesson.step.id, "W3");
  host.dispatch(checkRun(host));
  await turn();
  assert.equal(host.snapshot().lesson.beat.status, "fail");
  host.dispatch({ type: "hint.next" });
  return h;
}

test("a host restarted with inStepOf's value shows the same rung, streak, help and pending milestones", async () => {
  const a = await replayedToW3();
  assert.deepEqual(
    milestoneTypes(a.host),
    ["lesson.completed"],
    "the replay keeps its own lesson's milestone",
  );
  const was = a.host.snapshot().lesson;
  const inStep = JSON.parse(JSON.stringify(a.host.inStep()));
  const b = fakeHost({
    instance: "b",
    saved: a.adapters.store.saves.at(-1),
    checks: () => w3(false),
    inStep,
  });
  await b.host.open();
  assert.deepEqual(milestoneTypes(b.host), ["lesson.completed"]);
  b.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  const now = b.host.snapshot().lesson;
  assert.equal(now.step.id, "W3");
  assert.deepEqual(now.hints, was.hints);
  assert.equal(now.beat.fail, was.beat.fail);
  assert.equal(b.state().beat.notYets, a.state().beat.notYets);
  assert.equal(b.state().beat.notYets, 1);
  assert.deepEqual(b.state().stepHelp, a.state().stepHelp);
  assert.deepEqual(b.state().stepHelp, { "b-1 W3": "hints" });
  assert.deepEqual(
    b.heard.flatMap((h) => h.events).filter((e) => e.type === "check.notYet"),
    [],
    "the arrival run's same FAIL is no new Not yet",
  );
  // Without the in-Step state, all of it is lost.
  const c = fakeHost({
    saved: a.adapters.store.saves.at(-1),
    checks: () => w3(false),
  });
  await c.host.open();
  c.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  assert.deepEqual(c.host.snapshot().milestones, []);
  assert.deepEqual(c.host.snapshot().lesson.hints.shown, []);
});

test("inStep() inside a save holds the milestone that same turn marked", async () => {
  const h = fakeHost({ instance: "i1", saved: AT_END });
  await h.host.open();
  h.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  const inSave = [];
  const save = h.adapters.store.save.bind(h.adapters.store);
  h.adapters.store.save = (data, meta) => {
    inSave.push({
      kept: h.host.inStep(),
      shown: h.host.snapshot().milestones.length,
    });
    return save(data, meta);
  };
  h.host.dispatch({ type: "step.markDone" });
  assert.equal(inSave.length, 1);
  assert.equal(inSave[0].shown, 0, "saved before it shows");
  assert.deepEqual(inSave[0].kept.milestones, [
    { lesson: "b-1", event: COMPLETED },
  ]);
  assert.deepEqual(h.host.inStep().milestones, inSave[0].kept.milestones);
  assert.equal(inSave[0].kept.engine.lesson, "b-1");
});

test("a restored milestone gets an envelope id of the new instance and goes once on milestone.shown", async () => {
  const h = fakeHost({
    instance: "i2",
    saved: AT_W3,
    inStep: {
      milestones: [
        { lesson: "b-1", event: COMPLETED },
        { lesson: "b-1", event: { type: "check.passed", firstTime: true } },
        { lesson: "b-1" },
        "not one",
      ],
    },
  });
  await h.host.open();
  const [m, ...rest] = h.host.snapshot().milestones;
  assert.deepEqual(rest, [], "only milestone events come back");
  assert.deepEqual(m, {
    id: "i2.1",
    revision: 1,
    serverTime: h.clock.epoch(),
    ...COMPLETED,
  });
  assert.equal(h.host.eventsAfter("i2.1"), null, "never in the event ring");
  h.host.dispatch({ type: "milestone.shown", id: m.id });
  assert.deepEqual(h.host.snapshot().milestones, []);
  const revision = h.host.revision();
  h.host.dispatch({ type: "milestone.shown", id: m.id });
  assert.equal(h.host.revision(), revision, "once");
  assert.deepEqual(h.host.inStep().milestones, []);
});

test("with no inStep option the host is as before: initialState's arguments and save meta unchanged", async () => {
  const args = [];
  const engine = {
    initialState(a) {
      args.push(a);
      return initialState(a);
    },
    reduce,
  };
  const h = fakeHost({ saved: AT_W3, engine, checks: () => w3(false) });
  assert.equal(h.host.inStep(), null, "null before open()");
  await h.host.open();
  assert.equal("inStep" in args[0], false);
  assert.deepEqual(Object.keys(args[0]).sort(), [
    "course",
    "dir",
    "epoch",
    "facts",
    "now",
    "saved",
  ]);
  const metas = [];
  h.adapters.store.save = (data, meta) => {
    metas.push(meta);
    return true;
  };
  h.host.dispatch({ type: "lesson.open", lesson: "b-1" }, { id: "x" });
  assert.deepEqual(metas, [{ actionId: "x" }]);
});

// b-1 with W3 marked for the host to judge.
const judgedCourse = b1Only.map((l) =>
  l.id === "b-1"
    ? {
        ...l,
        judged: {
          "W3.0": { judge: "host", ladder: [{ kind: "hint", text: "Look." }] },
        },
      }
    : l,
);
const MISS = {
  type: "judged",
  beat: "b-1:W3:0",
  pass: false,
  items: [{ index: 0, text: "Names the file", pass: false, hint: "Name it." }],
  done: false,
};

test("Host.judged reduces a JudgedInput, saves with actionId null and settles after an async save", async () => {
  const h = fakeHost({ saved: AT_W3, course: judgedCourse });
  await h.host.open();
  h.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  assert.equal(h.adapters.checks.calls.length, 0, "no Check runs");
  const held = [];
  h.adapters.store.save = (data, meta) =>
    new Promise((resolve) => held.push({ meta, resolve }));
  let settled = false;
  const done = h.host.judged(MISS).then(() => (settled = true));
  await turn();
  assert.equal(held.length, 1);
  assert.deepEqual(held[0].meta, { actionId: null });
  assert.equal(settled, false, "not before the save settles");
  assert.equal(h.host.snapshot().lesson.beat.status, "waiting");
  held[0].resolve(true);
  await done;
  assert.equal(h.host.snapshot().lesson.beat.status, "fail");
  assert.equal(h.host.snapshot().lesson.beat.fail, "Name it.");
  const last = h.heard.at(-1);
  assert.equal(last.input.type, "judged");
  assert.deepEqual(
    last.events.map((e) => e.type),
    ["check.notYet"],
  );
});

test("a client cannot dispatch a judged input", async () => {
  const h = fakeHost({ saved: AT_W3, course: judgedCourse });
  await h.host.open();
  h.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  assert.throws(() => h.host.dispatch(MISS), TypeError);
  assert.throws(() => h.host.judged({ type: "check" }), TypeError);
  assert.equal(typesOf(h.heard).includes("judged"), false);
  assert.equal(h.host.snapshot().lesson.beat.status, "waiting");
});
