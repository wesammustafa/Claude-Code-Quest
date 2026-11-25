// @ts-check
// Goals and saved workflows (Fix-It course, the Advanced lab a-3). In the
// Worked example a `/goal` keeps one session working until the pages in
// samples/ link to library.example/whats-on/ instead of /events/, and the
// Learner runs the checks before committing. In Your turn Claude writes an
// audit workflow that has one agent look at each file of a folder and a
// second agent check each finding; the Learner reads it before approving,
// saves the run from /workflows, has Claude make it take its folder from
// `args`, runs it by name on a second folder and commits it.
//
// The check gathers its own evidence: the migration from the history (the
// links at the lab's first commit, at HEAD, and in each commit between), and
// the workflow by running the committed script with stand-in agents on two
// stub folders (a-3-run.mjs), so it sees which agents the script starts and
// what it returns. Whether a `/goal` was set and reported met in the
// Learner's session, and which finding the second agent refuted, the lab
// self-checks: no file the session writes records them.
//
// In the Fix-It course this file takes the place of the guide's own a-3
// check, whose `savedWorkflow` the guide's Advanced capstone check imports,
// so it keeps that export.
import { spawnSync } from 'node:child_process';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWorkflows, readWorkflow, STAGES, tokenize } from '../workflow-script.mjs';
import { nothingUncommitted, testsPass } from './b-3.mjs';
/** @import { Workflow } from '../workflow-script.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Goals and saved workflows';

const RUNNER = fileURLToPath(new URL('./a-3-run.mjs', import.meta.url));
const OLD = 'library.example/events/';
// The old address as `git grep` reads it: Questerm's git has no -F.
const OLD_PATTERN = 'library\\.example/events/';
const NEW = 'library.example/whats-on/';
const OLD_URL = /https?:\/\/library\.example\/events\/[^\s)>"'\]]*/g;
const SAMPLES = 'samples';

const code = (/** @type {unknown} */ text) => `\`${text}\``;
const and = (/** @type {string[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : (list[0] ?? ''));
const shell = (/** @type {string} */ path) => (/\s/.test(path) ? `"${path}"` : path);

// ---------------------------------------------------------------------------
// The migration

/**
 * @param {Repo} repo
 * @param {string[]} args
 */
function git(repo, ...args) {
  try {
    return repo.gitLocal(...args);
  } catch (error) {
    if (/** @type {{ status?: number | null }} */ (error).status === 1) return '';
    throw error;
  }
}

// The old links in samples/ at `rev`, by file (paths from this folder).
/**
 * @param {Repo} repo
 * @param {string} rev
 * @returns {Map<string, string[]>}
 */
function oldLinks(repo, rev) {
  /** @type {Map<string, string[]>} */
  const out = new Map();
  for (const line of git(repo, 'grep', '-I', '-e', OLD_PATTERN, rev, '--', SAMPLES).split('\n').filter(Boolean)) {
    const rest = line.slice(rev.length + 1);
    const at = rest.indexOf(':');
    const file = rest.slice(0, at);
    out.set(file, [...(out.get(file) ?? []), ...(rest.slice(at + 1).match(OLD_URL) ?? [])]);
  }
  return out;
}

const count = (/** @type {Map<string, string[]>} */ links) => [...links.values()].reduce((n, l) => n + l.length, 0);

/** @type {Item} */
export const migratedSamples = {
  text: `the pages in \`samples/\` link to \`${NEW}\` instead of \`${OLD}\` at \`HEAD\`, changed by commits made in this lab that touch nothing outside \`samples/\``,
  check(repo) {
    const roots = git(repo, 'rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean);
    const start = roots.at(-1);
    if (!start) return 'This repository has no commits. Run the check in this lab\'s practice copy.';
    const before = oldLinks(repo, start);
    if (!before.size) return `The lab's first commit has no link to \`${OLD}\` in \`samples/\`, so there is no migration to check. Run the check in this lab's practice copy.`;
    const now = oldLinks(repo, 'HEAD');
    if (now.size) {
      const files = [...now.keys()].map(code);
      const tree = git(repo, 'grep', '-I', '-l', '-e', OLD_PATTERN, '--', SAMPLES);
      if (!tree) return `${and(files)} ${files.length > 1 ? 'still link' : 'still links'} to \`${OLD}\` at \`HEAD\`, but not in your working tree: the migration isn't committed. Run the grep and the tests yourself, read \`git diff\`, then commit \`samples/\` (Worked example step 3).`;
      return `${and(files)} ${files.length > 1 ? 'still link' : 'still links'} to \`${OLD}\` at \`HEAD\`: \`git grep -n '${OLD}' -- samples\` lists the lines. Set the goal again, with the grep as its end state (Worked example step 2), then commit.`;
    }
    // Each old link now points at the same page under /whats-on/.
    for (const [file, links] of before) {
      const text = git(repo, 'show', `HEAD:./${file}`);
      const lost = links.map((l) => l.replace('/events/', '/whats-on/')).find((l) => !text.includes(l));
      if (lost) return `\`${file}\` no longer links to \`${lost}\`, where its old link to \`${lost.replace('/whats-on/', '/events/')}\` should point now. Only \`/events/\` changes to \`/whats-on/\`: put the link back with the rest of it as it was, and commit.`;
    }
    // The commits that removed old links change nothing outside samples/.
    const commits = git(repo, 'rev-list', '--reverse', `${start}..HEAD`).split('\n').filter(Boolean);
    for (const sha of commits) {
      const parent = `${sha}~1`;
      if (count(oldLinks(repo, sha)) >= count(oldLinks(repo, parent))) continue;
      const outside = git(repo, 'diff', '--name-only', parent, sha).split('\n').filter(Boolean)
        .map((p) => repo.local(p)).filter((p) => !p.startsWith(`${SAMPLES}/`));
      if (outside.length) {
        const subject = git(repo, 'log', '-1', '--format=%s', sha);
        return `The commit "${subject}" changes the library links and also ${and(outside.map(code))}, outside \`samples/\`. The goal said only files under \`samples/\` change, so the migration goes in a commit of its own. If that commit is your last, \`git reset --soft HEAD~1\` takes it back and keeps its changes: commit \`samples/\` first, then the rest.`;
      }
    }
    return true;
  },
};

// ---------------------------------------------------------------------------
// The workflow

// The stub folders the check runs a script on, each with its files, and the
// findings each file's agent reports, with the verdict a checking agent gives.
const STUB = {
  folders: {
    lib: ['lib/fetch.js', 'lib/cache.js', 'lib/parse.js'],
    scripts: ['scripts/build.js', 'scripts/deploy.js'],
  },
  findings: [
    { id: 'L1', file: 'lib/fetch.js', line: 12, reason: 'the catch returns null and drops the network error', verdict: 'CONFIRMED' },
    { id: 'L2', file: 'lib/fetch.js', line: 30, reason: 'the catch logs the timeout and throws it again', verdict: 'REFUTED' },
    { id: 'L3', file: 'lib/cache.js', line: 8, reason: 'the catch around reading the cache file falls back to an empty cache', verdict: 'REFUTED' },
    { id: 'L4', file: 'lib/parse.js', line: 41, reason: 'the empty catch block swallows the JSON parse error', verdict: 'CONFIRMED' },
    { id: 'S1', file: 'scripts/build.js', line: 5, reason: 'the catch around the build step ignores the error and exits 0', verdict: 'CONFIRMED' },
    { id: 'S2', file: 'scripts/deploy.js', line: 17, reason: 'the catch prints the upload error and exits 1', verdict: 'REFUTED' },
    { id: 'S3', file: 'scripts/deploy.js', line: 22, reason: 'the catch wraps the error with the host name and rethrows it', verdict: 'REFUTED' },
  ],
};
/** @typedef {typeof STUB.findings[number]} Finding */
/** @typedef {{ kind: string, prompt: string, folders: string[], files: string[], findings: string[] }} Call */

const FIX = /\b(?:fix|fixes|fixing|repair|rewrite|patch)\b|\b(?:edit|change|modify|update|correct)\s+(?:the|this|that|each|every|it|them|its)\b/gi;
const NEGATED = /\b(?:don't|do not|never|not|no|without)\b[^.;]*$/i;
// Whether `prompt` asks the agent to change code, outside a negation.
const asksToFix = (/** @type {string} */ prompt) => [...prompt.matchAll(FIX)].some((m) => !NEGATED.test(prompt.slice(Math.max(0, (m.index ?? 0) - 30), m.index)));

// The names a workflow can't reach in Claude Code: it has no module, file
// or shell access of its own.
const UNREACHABLE = new Set(['import', 'require', 'process']);
/** @param {string} text */
function reachesOut(text) {
  const tokens = tokenize(text);
  const k = tokens.findIndex((t, i) => t.type === 'name' && UNREACHABLE.has(t.value)
    && !['.', '?.'].includes(tokens[i - 1]?.value ?? '')
    && !(tokens[i + 1]?.value === ':' && ['{', ','].includes(tokens[i - 1]?.value ?? ''))
    && (t.value !== 'import' || tokens[i + 1]?.value === '('));
  return k === -1 ? null : /** @type {NonNullable<typeof tokens[number]>} */ (tokens[k]);
}

/**
 * Runs `text` with the stand-in agents on `folder`.
 * @param {string} text
 * @param {string} folder
 * @returns {{ calls: Call[], result?: unknown, error?: string }}
 */
function runScript(text, folder) {
  const run = spawnSync(process.execPath, [RUNNER], { input: JSON.stringify({ source: text, args: [folder], stub: STUB }), encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  try {
    return JSON.parse(run.stdout);
  } catch {
    return { calls: [], error: run.error?.message ?? (run.signal ? `it didn't finish in time (${run.signal})` : `${run.stderr ?? ''}`.trim().split('\n')[0] || 'it printed nothing') };
  }
}

const textOf = (/** @type {unknown} */ value) => (typeof value === 'string' ? value : JSON.stringify(value) ?? '');
const cited = (/** @type {string} */ text, /** @type {Finding} */ f) => text.includes(`${f.file}:${f.line}`) || text.includes(f.reason);

// What is wrong with one run of a script on `folder`, or null.
/**
 * @param {string} p the script's path, as code
 * @param {string} text
 * @param {string} folder
 * @returns {string | null}
 */
function runProblem(p, text, folder) {
  const { calls, result, error } = runScript(text, folder);
  const on = `Run on a folder \`${folder}/\``;
  const given = `${on} through \`args\` (\`${JSON.stringify([folder])}\`)`;
  if (error && !calls.length) return `${given}, ${p} stops before it starts an agent: ${error}. Claude passes the folder as the first item of \`args\`: have Claude change the script to read it from there (Your turn step 2), run \`/reload-skills\`, and commit.`;
  if (error) return `${on}, ${p} stops with an error: ${error}. Read the line it names, and have Claude fix the script (Your turn step 2).`;
  const files = STUB.folders[/** @type {keyof typeof STUB.folders} */ (folder)];
  const finders = calls.filter((c) => c.kind === 'finder');
  if (!finders.length) {
    if (calls.some((c) => c.kind === 'sweep')) return `${on}, ${p} has no agent look at one file on its own: one agent is handed the whole folder. Have Claude write the audit again with one agent per file (Your turn step 1), save it, and commit.`;
    if (calls.some((c) => c.folders.includes(folder)) && !calls.some((c) => c.folders.some((d) => d !== folder))) return `${on}, ${p} lists the folder's files but no agent looks at one of them. Have Claude give each file an agent of its own (Your turn step 1), and commit.`;
    return `${given}, ${p} never asks about that folder's files, so it doesn't take its folder from \`args\`. Ask Claude to change the script so it reads the folder from \`args\` (Your turn step 2), run \`/reload-skills\`, and commit.`;
  }
  const skipped = files.filter((f) => !finders.some((c) => c.files.includes(f)));
  if (skipped.length) return `${on}, no agent of ${p} looks at ${and(skipped.map(code))} on its own. The audit needs one agent per file in the folder: have Claude change the script so it starts one for each file the listing returns, and commit.`;
  const together = finders.find((c) => c.files.length > 1);
  if (together) return `${on}, one agent of ${p} is asked about ${and(together.files.map(code))} at once. Give each file its own agent, and commit.`;
  const findings = STUB.findings.filter((f) => files.includes(f.file));
  const checkers = calls.filter((c) => c.kind === 'checker');
  if (!checkers.length) return `${on}, ${p} reports what its file agents found without a second agent checking any of it. Have Claude add a stage that gives each finding to a checking agent, and reports only the confirmed ones (Your turn step 1), and commit.`;
  const several = checkers.find((c) => c.findings.length > 1);
  if (several) return `${on}, one checking agent of ${p} gets ${several.findings.length} findings at once, such as a file agent's whole answer. Split each answer into its findings, one per line, and give each its own checking agent, and commit.`;
  const unchecked = findings.filter((f) => !checkers.some((c) => c.findings.includes(f.id)));
  if (unchecked.length) return `${on}, no checking agent of ${p} sees the finding \`${unchecked[0]?.file}:${unchecked[0]?.line}\`. Each finding needs its own checking agent, and commit.`;
  const fixer = calls.find((c) => (c.kind === 'finder' || c.kind === 'checker') && asksToFix(c.prompt));
  if (fixer) return `${p} asks an agent to change code: "${fixer.prompt.split('\n')[0]?.slice(0, 120)}". The audit only reports, so no file changes when it runs. Have Claude take that out, and commit.`;
  const out = textOf(result);
  const refuted = findings.find((f) => f.verdict === 'REFUTED' && cited(out, f));
  if (refuted) return `${on}, ${p} returns \`${refuted.file}:${refuted.line}\`, a finding its checking agent refuted. Return only the findings whose checking agent answered CONFIRMED, and commit.`;
  const missing = findings.find((f) => f.verdict === 'CONFIRMED' && !cited(out, f));
  if (missing) return `${on}, ${p} leaves out \`${missing.file}:${missing.line}\`, a finding its checking agent confirmed. Return each confirmed finding with its file and line, and commit.`;
  return null;
}

// Why a script fails before it runs: readWorkflow's stages, then the names
// a workflow can't reach.
/**
 * @param {string} p
 * @param {Workflow} result
 */
function staticHint(p, result) {
  switch (result.problem) {
    case 'first': return `${p} doesn't start with \`export const meta\`${result.found ? `: its code starts with ${code(result.found)}` : ''}. Claude Code needs \`export const meta = { ... }\` as the script's first statement. Move it to the top (comments may stay above it) and commit.`;
    case 'literal': return `Line ${result.line} of ${p}: \`meta\` holds ${result.what}. When \`meta\` holds anything but literal values, Claude Code drops \`/<name>\` from \`/\` autocomplete. Write each value out, and commit.`;
    case 'fields': return `\`meta\` in ${p} needs ${(result.missing ?? []).map((f) => `a non-empty \`${f}\``).join(' and ')}. Add ${(result.missing ?? []).length > 1 ? 'them' : 'it'} and commit.`;
    case 'compile': return `${p} doesn't compile${result.line ? ` (line ${result.line})` : ''}: ${result.message}. Have Claude fix it, and commit.`;
    case 'args': {
      const why = result.declared
        ? `Line ${result.declared} of ${p} declares its own \`args\`, which hides the input Claude passes to the workflow.`
        : `${p} never reads \`args\`, so it audits the folder it names itself.`;
      return `${why} Ask Claude to change the script so it takes the folder from \`args\` (Your turn step 2), run \`/reload-skills\`, and commit.`;
    }
    default: return `${p} never calls \`agent()\`, so it starts no agent. Have Claude write the audit workflow again (Your turn step 1), save the run from \`/workflows\`, and commit.`;
  }
}

/** @param {{ path: string, rule: { line: number, source: string, pattern: string | undefined } | null }} script */
function uncommittedHint({ path, rule }) {
  if (!rule) return `${code(path)} isn't committed. Run \`git add ${shell(path)}\` and commit it (Your turn step 4).`;
  return `${code(path)} isn't committed, and line ${rule.line} of ${code(rule.source)}, ${code(rule.pattern)}, ignores it. Run \`git add -f ${shell(path)}\` and commit it.`;
}

const SAVE = 'When the audit run finishes, run `/workflows`, select the run, press `s`, keep the project location and press `Enter` (Your turn step 2). Then commit the `.js` file it saves.';

// One committed script, judged: null when it passes, else its problem and
// how far it got (a later stage is a script nearer to passing).
/**
 * @param {{ path: string, text: string, changed: boolean }} script
 * @returns {{ hint: string, rank: number } | null}
 */
function judgeScript({ path, text, changed }) {
  const p = code(path);
  const pending = changed ? ` Your copy of ${p} has changes that aren't committed: if they fix this, commit them.` : '';
  const read = readWorkflow(text, { needArgs: true, needAgentCall: true });
  if (!read.ok) return { hint: `${staticHint(p, read)}${pending}`, rank: STAGES.indexOf(/** @type {string} */ (read.problem)) };
  const reach = reachesOut(text);
  if (reach) return { hint: `Line ${reach.line} of ${p} uses \`${reach.value}\`. A workflow script has no module, file or shell access of its own in Claude Code: its agents read the files. Have Claude take it out (Your turn step 2), and commit.${pending}`, rank: STAGES.length };
  for (const folder of Object.keys(STUB.folders)) {
    const problem = runProblem(p, text, folder);
    if (problem) return { hint: `${problem}${pending}`, rank: STAGES.length + 1 };
  }
  return null;
}

/** @type {Item} */
export const auditWorkflow = {
  text: 'a committed workflow takes its folder from `args`, has an agent look at each file and a second agent check each finding on its own, returns only the confirmed findings, and asks no agent to change a file',
  check(repo) {
    const { scripts, misplaced, uncommitted } = findWorkflows(repo);
    /** @type {{ hint: string, rank: number } | null} */
    let best = null;
    for (const s of scripts) {
      const judged = judgeScript(s);
      if (!judged) return true;
      if (!best || judged.rank > best.rank) best = judged;
    }
    const also = uncommitted[0] ? ` Also, ${uncommittedHint(uncommitted[0])}` : '';
    if (best) return `${best.hint}${also}`;
    if (misplaced.length) {
      const path = /** @type {string} */ (misplaced[0]);
      const at = path.lastIndexOf('.claude/workflows/') + '.claude/workflows/'.length;
      return `${code(path)} is under \`.claude/workflows/\`, but Claude Code reads only \`.js\` files directly in that folder, where \`/workflows\` saves them. Move it to ${code(`${path.slice(0, at)}${posix.basename(path).replace(/\.[^.]+$/, '')}.js`)} and commit.`;
    }
    if (uncommitted[0]) return uncommittedHint(uncommitted[0]);
    return `There is no workflow script in \`.claude/workflows/\`. ${SAVE}`;
  },
};

// The guide's Advanced capstone check reads a saved workflow the way the
// guide's own a-3 check did: committed, a literal meta, and with options
// `needArgs`, `needAgentCall` and `needCheck` (at least two `agent()` calls).
/**
 * @param {{ needArgs?: boolean, needAgentCall?: boolean, needCheck?: boolean }} [options]
 * @returns {Item}
 */
export function savedWorkflow(options = {}) {
  const agentCalls = (/** @type {string} */ text) => {
    const tokens = tokenize(text);
    return tokens.filter((t, k) => t.type === 'name' && t.value === 'agent' && tokens[k + 1]?.value === '(' && !['.', '?.', 'function', 'async', 'const', 'let', 'var'].includes(tokens[k - 1]?.value ?? '')).length;
  };
  return {
    text: 'a committed script in `.claude/workflows/` has a literal `export const meta`, with a `name` and a `description`, as its first statement',
    check(repo) {
      const { scripts, uncommitted } = findWorkflows(repo);
      for (const s of scripts) {
        const read = readWorkflow(s.text, options);
        if (read.ok && (!options.needCheck || agentCalls(s.text) >= 2)) return true;
      }
      const s = scripts[0];
      if (s) {
        const read = readWorkflow(s.text, options);
        return read.ok ? `${code(s.path)} calls \`agent()\` only once, so no second agent checks what the first one finds. Have Claude add a checking agent, and commit.` : staticHint(code(s.path), read);
      }
      return uncommitted[0] ? uncommittedHint(uncommitted[0]) : `There is no workflow script in \`.claude/workflows/\`. ${SAVE}`;
    },
  };
}

/** @type {Item[]} */
export const items = [migratedSamples, auditWorkflow, testsPass, nothingUncommitted];
