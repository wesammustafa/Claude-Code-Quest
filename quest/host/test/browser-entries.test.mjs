// The browser-safe import walk (Quest Simulator's seam S7): the entries a
// browser host loads, the host core (@quest/host/core), the engine and its
// course data (@quest/engine/course-data) and the client, reach no node:
// module through their relative imports. #crypto is followed to its
// browser file, as a bundler with the "browser" condition resolves it.
// Cross-package runtime imports stay relative, so the walk sees them.
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const QUEST = fileURLToPath(new URL("../../", import.meta.url));
const ENTRIES = [
  "host/src/core.ts",
  "engine/src/index.ts",
  "engine/src/course-data.ts",
  "client/src/main.tsx",
];
const SPECIFIER =
  /(?:^|[\s;])(import|export)\s+(type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;
const BUILTINS = new Set(builtinModules);

function packageDir(file) {
  let dir = dirname(file);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
}

// A #import, resolved by its package's "imports" map, browser first.
function hashImport(file, spec) {
  const dir = packageDir(file);
  const map =
    JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).imports ?? {};
  const target = map[spec];
  const path =
    typeof target === "string" ? target : (target?.browser ?? target?.default);
  return path ? join(dir, path) : null;
}

function resolveFile(base) {
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")])
    if (existsSync(c) && /\.(ts|tsx|mts|mjs|js)$/.test(c)) return c;
  return null;
}

function walk(entries) {
  const problems = [];
  const seen = new Set();
  const queue = entries.map((e) => join(QUEST, e));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(SPECIFIER)) {
      const typeOnly = Boolean(m[2]);
      const spec = m[3] ?? m[4];
      if (typeOnly) continue;
      const short = file.slice(QUEST.length);
      if (spec.startsWith("node:") || BUILTINS.has(spec.split("/")[0]))
        problems.push(`${short}: imports ${spec}`);
      else if (spec.startsWith("#")) {
        const next = hashImport(file, spec);
        if (next) queue.push(next);
        else problems.push(`${short}: ${spec} has no browser file`);
      } else if (spec.startsWith(".")) {
        const next = resolveFile(resolve(dirname(file), spec));
        if (next) queue.push(next);
      } else if (spec.startsWith("@quest/") && !short.startsWith("client/"))
        problems.push(
          `${short}: imports ${spec} by package, not by relative path`,
        );
    }
  }
  return { problems, seen };
}

test("the browser entries reach no node: module", () => {
  const { problems, seen } = walk(ENTRIES);
  assert.deepEqual(problems, []);
  assert.ok(
    [...seen].some((f) => f.endsWith("engine/src/crypto.browser.ts")),
    "the walk follows #crypto to its browser file",
  );
  assert.ok([...seen].some((f) => f.endsWith("host/src/host.ts")));
});

test("the walk finds a node: import planted in the host core", () => {
  const { problems } = walk(["host/src/node-host.ts"]);
  assert.ok(
    problems.some((p) => p.includes("node:os")),
    problems.join("\n"),
  );
});
