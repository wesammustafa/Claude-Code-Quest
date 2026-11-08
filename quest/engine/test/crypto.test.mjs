// The browser hashing stand-in (#crypto, browser condition) gives the same
// digests as node:crypto for strings, bytes and every padding boundary.
import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as browser from "../src/crypto.browser.ts";
import * as node from "../src/crypto.node.ts";

const inputs = [
  "",
  "abc",
  "héllo wörld ✓ 🎉",
  "a".repeat(55),
  "a".repeat(56),
  "a".repeat(63),
  "a".repeat(64),
  "a".repeat(1000),
];

describe("#crypto", () => {
  for (const algo of ["sha1", "sha256"]) {
    const fn = algo === "sha1" ? "sha1Hex" : "sha256Hex";
    it(`${algo} matches node:crypto on strings`, () => {
      for (const s of inputs) {
        const want = createHash(algo).update(s).digest("hex");
        expect(browser[fn](s)).toBe(want);
        expect(node[fn](s)).toBe(want);
      }
    });
    it(`${algo} matches node:crypto on bytes`, () => {
      for (let n = 0; n < 200; n += 7) {
        const bytes = new Uint8Array(randomBytes(n));
        expect(browser[fn](bytes)).toBe(
          createHash(algo).update(bytes).digest("hex"),
        );
      }
    });
  }
});
