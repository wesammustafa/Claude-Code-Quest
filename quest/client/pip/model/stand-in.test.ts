// @vitest-environment node
// The committed stand-in model is exactly what stand-in.ts writes, and says
// it is a stand-in, so a change to the script that is not rewritten fails
// here (`npm run pip:stand-in` rewrites it).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { packGlb, unpackGlb } from "./glb.ts";
import { STAND_IN_FILE, standInModel } from "./stand-in.ts";

const committed = () =>
  new Uint8Array(readFileSync(join(import.meta.dirname, STAND_IN_FILE)));

test("the committed stand-in is what stand-in.ts writes", () => {
  expect(Buffer.from(committed()).equals(Buffer.from(standInModel()))).toBe(
    true,
  );
});

test("it says it is a stand-in", () => {
  const { json } = unpackGlb(committed());
  expect(json).toMatchObject({
    asset: { version: "2.0", extras: { standIn: true } },
  });
});

test("unpackGlb and packGlb round-trip a model", () => {
  const { json, bin } = unpackGlb(committed());
  expect(Buffer.from(packGlb(json, bin)).equals(Buffer.from(committed()))).toBe(
    true,
  );
});
