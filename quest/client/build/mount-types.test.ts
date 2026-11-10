// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vitest";

const CLIENT = fileURLToPath(new URL("../", import.meta.url));

test("@quest/client/mount/types typechecks with no ambient types, as a page built without Vite's client types imports it", () => {
  const exports = (
    JSON.parse(readFileSync(`${CLIENT}package.json`, "utf8")) as {
      exports: Record<string, string>;
    }
  ).exports;
  const entry = exports["./mount/types"];
  expect(entry).toBe("./src/mount/types.ts");

  const program = ts.createProgram([`${CLIENT}${entry ?? ""}`], {
    target: ts.ScriptTarget.ES2022,
    lib: ["lib.es2024.d.ts", "lib.dom.d.ts"],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    exactOptionalPropertyTypes: true,
    verbatimModuleSyntax: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const problems = ts
    .getPreEmitDiagnostics(program)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(problems).toEqual([]);
  // The graph holds the mount's types and what they name, not the screens.
  const own = program
    .getSourceFiles()
    .map((f) => f.fileName)
    .filter((f) => f.startsWith(`${CLIENT}src/`))
    .map((f) => f.slice(CLIENT.length))
    .sort();
  expect(own).not.toContain("src/mount.tsx");
  expect(own).not.toContain("src/routes.tsx");
});
