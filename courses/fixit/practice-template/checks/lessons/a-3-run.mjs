// @ts-check
// Runs one saved workflow script with stand-in agents, for the a-3 lab's
// check (a-3.mjs). Claude Code runs a workflow's body as plain JavaScript
// with `args`, `agent()`, `pipeline()` and `parallel()` (and `phase()` and
// `log()`) as its free names; here each agent call is answered from a stub
// folder instead of a subagent, so the check sees which agents the script
// starts, on what, and what it returns.
//
// Reads `{ source, args, stub }` as JSON on stdin, where `stub` is
// `{ folders: { <folder>: [file, ...] }, findings: [{ id, file, line, reason, verdict }] }`,
// and prints `{ calls, result }` or `{ calls, error }`. Each call is
// `{ kind, prompt, folders, files, findings }`: `checker` when its prompt
// cites a finding, `finder` when it names a file, `sweep` when it names a
// stub folder and asks about errors, `listing` when it names a stub folder
// and nothing else, `other` otherwise. An agent asked to list a folder's files
// gets them; one asked about a file gets that file's findings, one per line
// as `file:line: reason`; one asked about a finding gets `CONFIRMED` or
// `REFUTED`, then a sentence. A call with a `schema` gets JSON of that shape.
import { readFileSync } from 'node:fs';

/** @typedef {{ id: string, file: string, line: number, reason: string, verdict: 'CONFIRMED' | 'REFUTED' }} Finding */
/** @typedef {{ folders: Record<string, string[]>, findings: Finding[] }} Stub */

const LIMIT = 200;
const AUDITS = /\b(?:catch\w*|caught|errors?|exceptions?|swallow\w*|drop\w*|ignor\w*)\b/i;
const { source, args, stub } = /** @type {{ source: string, args: unknown, stub: Stub }} */ (JSON.parse(readFileSync(0, 'utf8')));
const files = Object.values(stub.folders).flat();

const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A path or folder written as a word of its own: `project/lib/` names lib,
// `library` does not.
const names = (/** @type {string} */ text, /** @type {string} */ path) => new RegExp(`(?<![\\w.-])${escape(path)}(?![\\w-])`).test(text);
const cites = (/** @type {string} */ text, /** @type {Finding} */ f) => text.includes(`${f.file}:${f.line}`) || text.includes(f.reason);
const asLine = (/** @type {Finding} */ f) => `${f.file}:${f.line}: ${f.reason}`;
const confirmed = (/** @type {Finding} */ f) => f.verdict === 'CONFIRMED';
const sentence = (/** @type {Finding} */ f) => `${f.verdict}. ${f.file}:${f.line} ${confirmed(f) ? 'catches the error and drops it: nothing reports it' : 'does not drop the error: it reports it or throws it again'}.`;

/** @param {any} schema */
const props = (schema) => (schema && typeof schema === 'object' && schema.properties && typeof schema.properties === 'object' ? Object.entries(schema.properties) : []);
/** @param {any} schema */
const isArray = (schema) => schema?.type === 'array' || Boolean(schema?.items);

// A finding as an object of the shape a schema's items ask for.
/**
 * @param {any} item
 * @param {Finding} f
 */
function findingObject(item, f) {
  if (item?.type === 'string' || !props(item).length) return asLine(f);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, s] of props(item)) {
    if (/file|path/i.test(key)) out[key] = f.file;
    else if (/line/i.test(key)) out[key] = s?.type === 'string' ? String(f.line) : f.line;
    else out[key] = asLine(f);
  }
  return out;
}

// A list in the shape `schema` asks for: the list itself, or an object with
// the list under its first list property.
/**
 * @param {any} schema
 * @param {unknown[]} list
 * @param {(item: any, value: any) => unknown} [shape]
 */
function listShaped(schema, list, shape = (_, v) => v) {
  if (isArray(schema)) return list.map((v) => shape(schema.items, v));
  const entries = props(schema);
  const key = entries.find(([, s]) => isArray(s))?.[0] ?? entries[0]?.[0] ?? 'items';
  const item = entries.find(([k]) => k === key)?.[1]?.items;
  return { [key]: list.map((v) => shape(item, v)) };
}

// A verdict in the shape `schema` asks for.
/**
 * @param {any} schema
 * @param {Finding} f
 */
function verdictShaped(schema, f) {
  const yes = confirmed(f);
  if (schema?.type === 'boolean') return yes;
  if (Array.isArray(schema?.enum)) return pick(schema.enum, yes) ?? f.verdict;
  if (!props(schema).length) return sentence(f);
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, s] of props(schema)) {
    if (s?.type === 'boolean') out[key] = yes;
    else if (Array.isArray(s?.enum)) out[key] = pick(s.enum, yes) ?? f.verdict;
    else if (/verdict|status|result|decision|outcome/i.test(key)) out[key] = f.verdict;
    else out[key] = sentence(f);
  }
  return out;
}

/**
 * @param {unknown[]} values
 * @param {boolean} yes
 */
function pick(values, yes) {
  const want = yes ? /confirm|true|yes|real|valid|keep/i : /refut|false|no|drop|invalid|reject/i;
  return values.find((v) => want.test(String(v)));
}

/** @type {{ kind: string, prompt: string, folders: string[], files: string[], findings: string[] }[]} */
const calls = [];

/**
 * @param {unknown} prompt
 * @param {any} [opts]
 */
async function agent(prompt, opts) {
  if (calls.length >= LIMIT) throw new Error(`the script started more than ${LIMIT} agents`);
  const text = String(prompt);
  const schema = opts && typeof opts === 'object' ? opts.schema : undefined;
  const cited = stub.findings.filter((f) => cites(text, f));
  const named = files.filter((p) => names(text, p));
  const folders = Object.keys(stub.folders).filter((d) => names(text, d));
  // A prompt that names a folder and asks about errors audits the folder
  // whole; one that names a folder and nothing else lists it.
  const sweep = folders.length > 0 && AUDITS.test(text);
  const kind = cited.length ? 'checker' : named.length ? 'finder' : sweep ? 'sweep' : folders.length ? 'listing' : 'other';
  calls.push({ kind, prompt: text, folders, files: named, findings: cited.map((f) => f.id) });
  if (kind === 'checker') {
    const f = /** @type {Finding} */ (cited[0]);
    return schema ? verdictShaped(schema, f) : sentence(f);
  }
  if (kind === 'finder') {
    const found = stub.findings.filter((f) => named.includes(f.file));
    return schema ? listShaped(schema, found, findingObject) : found.map(asLine).join('\n') || 'NONE';
  }
  if (kind === 'sweep') {
    const found = stub.findings.filter((f) => folders.some((d) => f.file.startsWith(`${d}/`)));
    return schema ? listShaped(schema, found, findingObject) : found.map(asLine).join('\n') || 'NONE';
  }
  if (kind === 'listing') {
    const list = folders.flatMap((d) => stub.folders[d] ?? []);
    return schema ? listShaped(schema, list) : list.join('\n');
  }
  return schema ? listShaped(schema, []) : 'NONE';
}

/**
 * @param {Iterable<unknown>} items
 * @param {((item: any, index: number) => unknown) | undefined} fn
 */
async function stage(items, fn) {
  const list = [...items];
  // A list of tasks, each a function, runs as it is.
  const run = typeof fn === 'function' ? fn : (/** @type {any} */ task) => (typeof task === 'function' ? task() : task);
  return Promise.all(list.map((item, i) => run(item, i)));
}

const globals = { args, agent, pipeline: stage, parallel: stage, phase: () => {}, log: () => {} };
for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });

// The first statement's `export`, blanked, as Claude Code strips it.
const body = source.replace(/^﻿/, '').replace(/^((?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*)export(?=\s+const\s+meta\b)/, '$1      ');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
try {
  const result = await new AsyncFunction(body)();
  process.stdout.write(JSON.stringify({ calls, result: result === undefined ? null : result }));
} catch (error) {
  process.stdout.write(JSON.stringify({ calls, error: error instanceof Error ? error.message : String(error) }));
}
