// The host seams a browser host builds on (Quest Simulator's S1 and S8):
// a store whose save settles later holds the queue until it does, each save
// says which client action caused it, a stamps adapter answers stamp
// effects in the same turn, and the core has no node: module. With none of
// these used the host behaves as before.
import { test } from "vitest";
import assert from "node:assert/strict";
import { AT_W3, fakeHost, ROOT, scripted, turn, typesOf } from "./scripted.mjs";

async function asking(effects, opts = {}) {
  const { engine, log } = scripted({
    effects: { "waitQuestion.answer": effects },
  });
  const made = fakeHost({ saved: AT_W3, engine, ...opts });
  await made.host.open();
  made.log = log;
  made.ask = (o) => made.host.dispatch({ type: "waitQuestion.answer" }, o);
  return made;
}

// A store whose saves settle when the test says.
function heldStore(adapters) {
  const held = [];
  adapters.store.save = (data, meta) => {
    let resolve;
    const done = new Promise((r) => (resolve = r));
    held.push({ data, meta, resolve });
    return done;
  };
  return held;
}

test("a save that returns a promise holds publishing and the next input until it settles", async () => {
  const { host, adapters, heard, ask } = await asking([{ type: "save" }]);
  const held = heldStore(adapters);
  ask();
  await turn();
  assert.equal(held.length, 1);
  assert.deepEqual(typesOf(heard), [], "nothing published before the save");
  let idle = false;
  void host.idle().then(() => (idle = true));
  ask();
  await turn();
  assert.equal(held.length, 1, "the next input waits for the save");
  held[0].resolve(true);
  await turn();
  assert.deepEqual(typesOf(heard), ["waitQuestion.answer"]);
  assert.equal(held.length, 2);
  assert.equal(idle, false);
  held[1].resolve(true);
  await turn();
  assert.deepEqual(typesOf(heard), [
    "waitQuestion.answer",
    "waitQuestion.answer",
  ]);
  assert.equal(idle, true);
});

test("a save that rejects shows the save notice and the host goes on", async () => {
  const { adapters, heard, ask } = await asking([{ type: "save" }]);
  const held = heldStore(adapters);
  ask();
  await turn();
  held[0].resolve(
    Promise.reject(Object.assign(new Error("x"), { code: "EIO" })),
  );
  await turn();
  assert.ok(typesOf(heard).includes("waitQuestion.answer"));
  assert.ok(
    heard.some((h) => h.input.type === "notice" && h.input.message === "EIO"),
  );
});

test("each save carries the client's action id, and only the save its own input caused", async () => {
  const { adapters, ask } = await asking([{ type: "save" }]);
  const metas = [];
  adapters.store.save = (data, meta) => {
    metas.push(meta);
    return true;
  };
  ask({ id: "a-1" });
  ask();
  await turn();
  assert.deepEqual(metas, [{ actionId: "a-1" }, { actionId: null }]);
});

test("the action id never reaches the engine", async () => {
  const made = await asking([]);
  made.host.dispatch({ type: "waitQuestion.answer" }, { id: "y" });
  await turn();
  const reduced = made.log.find((l) => l.type === "waitQuestion.answer");
  assert.equal("id" in reduced.input, false);
});

test("with a stamps adapter, stamps are answered in the same turn and the turn saves once, after them", async () => {
  const { adapters, heard, ask, log } = await asking([
    { type: "stamp", key: "W3.0", dir: ROOT, path: "notes.md" },
    { type: "stamp", key: "W4.0", dir: ROOT, git: "head" },
    { type: "save" },
  ]);
  const order = [];
  adapters.stamps = {
    now: (e) => {
      order.push(`stamp ${e.key}`);
      return e.git ? undefined : "S";
    },
  };
  const save = adapters.store.save.bind(adapters.store);
  adapters.store.save = (data, meta) => {
    order.push("save");
    return save(data, meta);
  };
  ask();
  await turn();
  assert.deepEqual(order.slice(0, 3), ["stamp W3.0", "stamp W4.0", "save"]);
  adapters.git.calls[0].resolve({ paths: [], staged: [], head: null });
  await turn();
  const answered = log.filter((l) => l.type === "stamp");
  assert.deepEqual(
    answered.map((l) => [l.input.key, l.input.stamp]),
    [
      ["W3.0", "S"],
      ["W4.0", ""],
    ],
    "W3.0 in the same turn; W4.0, left to git, after it",
  );
  assert.equal(
    adapters.git.calls.length,
    1,
    "only the stamp left undefined read git",
  );
  assert.equal(
    heard.filter((h) => h.input.type === "stamp").length,
    1,
    "only W4.0, read later, is an input of its own; W3.0 is part of its turn",
  );
});

test("without a stamps adapter, stamps come after the turn as before", async () => {
  const { heard, ask } = await asking([
    { type: "stamp", key: "W3.0", dir: ROOT, path: "notes.md" },
  ]);
  ask();
  await turn();
  assert.deepEqual(typesOf(heard), ["waitQuestion.answer", "stamp"]);
});
