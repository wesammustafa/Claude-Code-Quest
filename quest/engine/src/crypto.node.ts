// The engine's hashing on Node: node:crypto. The browser build resolves
// #crypto to crypto.browser.ts instead (package.json "imports"), so the
// engine's import graph in a page has no node: module.
import { createHash } from "node:crypto";

export const sha1Hex = (data: string | Uint8Array): string =>
  createHash("sha1").update(data).digest("hex");

export const sha256Hex = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");
