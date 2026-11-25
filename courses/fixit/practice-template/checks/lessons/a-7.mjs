// @ts-check
// Bound an unattended run (Fix-It, Advanced lesson 3). The check reads the
// easy-read refresh's bounds, runs its runner with the guide's stand-in for
// `claude` to read the flags it passes, reads the result its last slice
// saved, and compares the June page with its state before Your turn's
// slice. The bounds may let the run edit only the easy-read pages, must
// keep it out of private folders and off the sources, and must make it
// refuse to start without the sandbox. The slice record is the result file
// the runner wrote: the host keeps no record of its own runs yet, so a
// Learner could write that file by hand, and the lesson says so.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseClaudeArgs } from '../claude-args.mjs';
import { scrubbed, stubText, STUB_SESSION, TIME_LIMIT } from '../stub-claude.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Bound an unattended run';

export const BOUNDS = 'fixit/summer/run/easy-bounds.json';
export const RUNNER = 'fixit/summer/run/easy-refresh.sh';
export const RESULT = 'fixit/summer/run/easy-last-run/result.json';
export const USED = 'fixit/summer/run/easy-last-run/bounds.json';
export const JUNE = 'fixit/summer/public/june.md';

const BOUNDS_NAME = '`summer/run/easy-bounds.json`';
const EASY = ['june-easy.md', 'july-easy.md', 'august-easy.md'].map((n) => `summer/public/${n}`);
// Files the easy-read run must never be allowed to edit, from `fixit/`.
const OTHERS = [
  'summer/public/june.md',
  'summer/public/july.md',
  'summer/public/august.md',
  'summer/public/schedule.md',
  'summer/public/index.md',
  'sources/group-notes.md',
  'summer/meeting-notes-2027-05-27.md',
  'summer/booking-june-roomB.md',
  'summer/run/easy-bounds.json',
  'summer/run/easy-refresh.sh',
  'CLAUDE.md',
  '.claude/settings.json',
];
// Commands no allow rule may let through: any command by way of a shell or
// node, and every git write, however it is spelled.
const COMMANDS = [
  'rm -rf summer',
  "sh -c 'rm -rf summer'",
  "bash -c 'git push'",
  "node -e 'require(\"fs\").rmSync(\"summer\", { recursive: true })'",
  'git add summer/public/june-easy.md',
  "git commit -m 'Refresh'",
  'git push origin main',
  "git -C . commit -m 'Refresh'",
];

const code = (/** @type {string} */ text) => `\`${text}\``;
/** @type {(value: unknown) => value is Record<string, any>} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A path pattern as Claude Code reads one in a `--settings` file run from
// `fixit/`: `./` and a bare path with a slash start at `fixit/`, a path with
// no slash matches at any depth, `*` stays inside one folder and `**` spans
// folders. Null for a pattern anchored anywhere else (`/`, `//`, `~/`).
/** @param {string} pattern */
function pathRegex(pattern) {
  if (/^(\/|~)/.test(pattern)) return null;
  const pat = pattern.replace(/^\.\//, '');
  const anchored = pattern.startsWith('./') || pat.replace(/\/$/, '').includes('/');
  let out = '';
  for (let i = 0; i < pat.length; i++) {
    if (pat.startsWith('**/', i)) {
      out += '(?:.*/)?';
      i += 2;
    } else if (pat.startsWith('**', i)) {
      out += '.*';
      i += 1;
    } else if (pat[i] === '*') out += '[^/]*';
    else if (pat[i] === '?') out += '[^/]';
    else out += escape(/** @type {string} */ (pat[i]));
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${out}(?:/.*)?$`);
}

// A rule as written: its tool, and the text in its brackets (null for a
// bare tool name).
/** @param {unknown} rule */
function ruleOf(rule) {
  const m = String(rule).trim().match(/^([A-Za-z]+)(?:\((.*)\))?$/s);
  return m ? { tool: /** @type {string} */ (m[1]), spec: m[2] === undefined ? null : m[2].trim() } : { tool: '', spec: null };
}

// Whether a path rule of `tools` covers `path` (from `fixit/`). A bare tool
// name, `Tool(*)` and `Tool(**)` cover every path.
/**
 * @param {unknown} rule
 * @param {string[]} tools
 * @param {string} path
 */
function covers(rule, tools, path) {
  const { tool, spec } = ruleOf(rule);
  if (!tools.includes(tool)) return false;
  if (spec === null || spec === '*' || spec === '**') return true;
  return pathRegex(spec)?.test(path) ?? false;
}

// A Bash pattern as Claude Code matches it: `*` is any text, and a trailing
// ` *` also matches the bare command.
/**
 * @param {unknown} rule
 * @param {string} command
 */
function letsThrough(rule, command) {
  const { tool, spec } = ruleOf(rule);
  if (tool !== 'Bash') return false;
  if (spec === null || spec === '*') return true;
  const p = spec.endsWith(':*') ? `${spec.slice(0, -2)} *` : spec;
  if (p.endsWith(' *') && command === p.slice(0, -2)) return true;
  return new RegExp(`^${p.split('*').map(escape).join('.*')}$`, 's').test(command);
}

/** @param {Repo} repo */
function loadBounds(repo) {
  const text = repo.read(BOUNDS);
  if (text === null) return { problem: `There's no ${BOUNDS_NAME} yet. Ask Claude to write the easy-read run's bounds there.` };
  try {
    const value = JSON.parse(text);
    if (!isObject(value)) return { problem: `${BOUNDS_NAME} isn't one JSON object.` };
    return { value };
  } catch (error) {
    return { problem: `${BOUNDS_NAME} isn't valid JSON (${/** @type {Error} */ (error).message}). Is a comma or a bracket missing?` };
  }
}

/** @param {unknown} list */
const rules = (list) => (Array.isArray(list) ? list : []);

/** @type {Item} */
export const boundsNarrow = {
  text: '`easy-bounds.json` lets the run edit only the easy-read pages, keeps it out of private folders and off the sources, and makes it refuse to start without the sandbox',
  check(repo) {
    const { value, problem } = loadBounds(repo);
    if (!value) return /** @type {string} */ (problem);
    const allow = rules(value.permissions?.allow);
    const deny = rules(value.permissions?.deny);
    for (const rule of allow) {
      const { tool, spec } = ruleOf(rule);
      if (!['Edit', 'Write'].includes(tool)) continue;
      if (spec !== null && /^(\/|~)/.test(spec))
        return `${code(String(rule))} names a path from outside \`fixit/\`. Name each page from \`fixit/\`, as in \`Edit(./summer/public/june-easy.md)\`.`;
      const other = OTHERS.find((path) => covers(rule, ['Edit', 'Write'], path));
      if (other?.startsWith('summer/public/'))
        return `${code(String(rule))} lets the run change ${code(other)} too, not just the easy-read pages. Name the three easy-read pages, or the \`*-easy.md\` pattern.`;
      if (other) return `${code(String(rule))} lets the run change ${code(other)}. This run edits only the three easy-read pages.`;
    }
    const missing = EASY.find((path) => !allow.some((rule) => covers(rule, ['Edit', 'Write'], path)));
    if (missing) return `Nothing in ${BOUNDS_NAME} lets the run edit ${code(missing)}, so a weekly run couldn't refresh it. Allow each of the three easy-read pages.`;
    if (!deny.some((rule) => covers(rule, ['Read'], 'summer/private/roster.csv')))
      return 'No deny rule keeps the run out of a `private/` folder. Add `Read(**/private/**)` to deny: a deny rule wins over any allow rule.';
    if (!deny.some((rule) => covers(rule, ['Edit', 'Write'], 'sources/group-notes.md')))
      return 'No deny rule stops the run changing `sources/`, the files it checks against. Add `Edit(./sources/**)` to deny.';
    const wide = allow.find((rule) => COMMANDS.some((c) => letsThrough(rule, c)));
    if (wide) {
      const command = /** @type {string} */ (COMMANDS.find((c) => letsThrough(wide, c)));
      return `${code(String(wide))} lets the run run ${code(command)}. This run needs no commands: take the rule out.`;
    }
    if (value.permissions?.defaultMode === 'bypassPermissions')
      return '`"defaultMode": "bypassPermissions"` skips every permission check. Take it out: nobody is there to press No.';
    const sandbox = value.sandbox;
    if (!isObject(sandbox)) return `${BOUNDS_NAME} has no \`sandbox\` settings. Add \`"sandbox": {"enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false}\`.`;
    if (sandbox.enabled !== true) return 'Set `"enabled": true` in `sandbox`, so any command runs fenced in.';
    if (sandbox.failIfUnavailable !== true) return 'Set `"failIfUnavailable": true` in `sandbox`: without it, a run whose sandbox can\'t start runs without one.';
    if (sandbox.allowUnsandboxedCommands !== false)
      return 'Set `"allowUnsandboxedCommands": false` in `sandbox`, so a command can\'t step outside the fence. At 02:00 nobody is there to ask.';
    if (sandbox.autoAllowBashIfSandboxed === true)
      return '`"autoAllowBashIfSandboxed": true` lets every fenced command run without a rule. Take it out, so your rules decide.';
    return true;
  },
};

// The runner run with the stand-in, once per repository: the arguments of
// each `claude` call it made, and how it ended. It runs in a scratch copy
// of `fixit/summer/`, so the Learner's files never change. With no bounds
// file yet, the copy gets an empty one, so this item judges the runner
// alone.
/** @typedef {{ argv: string[][], status: number | null, stderr: string, timedOut: boolean }} Stood */
/** @type {WeakMap<Repo, Stood>} */
const cache = new WeakMap();

/** @param {Repo} repo */
function standIn(repo) {
  const known = cache.get(repo);
  if (known) return known;
  const base = mkdtempSync(join(tmpdir(), 'fixit-a7-'));
  try {
    const root = join(base, 'repo', 'fixit');
    for (const folder of ['bin', 'calls', 'home', 'config']) mkdirSync(join(base, folder), { recursive: true });
    const put = (/** @type {string} */ rel, /** @type {string} */ text) => {
      mkdirSync(dirname(join(root, rel)), { recursive: true });
      writeFileSync(join(root, rel), text);
    };
    const pages = join(repo.dir, 'fixit/summer/public');
    for (const name of existsSync(pages) ? readdirSync(pages).filter((n) => n.endsWith('.md')) : []) put(`summer/public/${name}`, repo.read(`fixit/summer/public/${name}`) ?? '');
    for (const name of ['easy-refresh.sh', 'bookings-only.json']) {
      const text = repo.read(`fixit/summer/run/${name}`);
      if (text !== null) put(`summer/run/${name}`, text);
    }
    put('summer/run/easy-bounds.json', repo.read(BOUNDS) ?? '{}\n');
    chmodSync(join(root, 'summer/run/easy-refresh.sh'), 0o755);
    writeFileSync(join(base, 'bin', 'claude'), stubText(base, 'linux'));
    chmodSync(join(base, 'bin', 'claude'), 0o755);
    const reply = { type: 'result', subtype: 'success', is_error: false, num_turns: 1, result: 'STUB', session_id: STUB_SESSION, total_cost_usd: 0, permission_denials: [] };
    writeFileSync(join(base, 'reply.json'), `${JSON.stringify(reply)}\n`);
    writeFileSync(join(base, 'stderr'), '');
    writeFileSync(join(base, 'exit'), '0\n');
    const run = spawnSync('bash', ['summer/run/easy-refresh.sh', 'june'], {
      cwd: root,
      env: scrubbed({ HOME: join(base, 'home'), CLAUDE_CONFIG_DIR: join(base, 'config') }, join(base, 'bin'), 'linux'),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: TIME_LIMIT,
      killSignal: 'SIGKILL',
    });
    const calls = join(base, 'calls');
    const argv = readdirSync(calls)
      .filter((n) => n.endsWith('.argv'))
      .map((n) => Number.parseInt(n, 10))
      .sort((a, b) => a - b)
      .map((i) => readFileSync(join(calls, `${i}.argv`), 'utf8').split('\0').slice(0, -1));
    const stood = { argv, status: run.status, stderr: run.stderr ?? '', timedOut: /** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ETIMEDOUT' };
    cache.set(repo, stood);
    return stood;
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** @param {Repo} repo */
function runnerCall(repo) {
  if (repo.read(RUNNER) === null) return { problem: '`summer/run/easy-refresh.sh` is missing. Reset this step to bring it back.' };
  const stood = standIn(repo);
  const calls = stood.argv.map(parseClaudeArgs).filter((a) => a.print);
  if (calls.length === 0) {
    if (stood.timedOut) return { problem: `The runner was still running after ${TIME_LIMIT / 1000} seconds, so the check stopped it.` };
    const said = stood.stderr.trim().split('\n').slice(-1)[0];
    return { problem: `The runner never reached its \`claude -p\` command${said ? `: it printed "${said}"` : ''}. Reset this step to bring the runner back as it was.` };
  }
  return { args: /** @type {ReturnType<typeof parseClaudeArgs>} */ (calls[0]) };
}

const positive = (/** @type {unknown} */ v) => typeof v === 'string' && /^(\d+(\.\d*)?|\.\d+)$/.test(v) && Number(v) > 0;

/** @type {Item} */
export const runnerBounded = {
  text: 'the runner starts `claude -p` in `dontAsk` mode with `easy-bounds.json`, a turn limit, a spend limit and JSON output, and never skips permissions',
  check(repo) {
    const { args, problem } = runnerCall(repo);
    if (!args) return /** @type {string} */ (problem);
    const f = args.flags;
    if (f.dangerouslySkipPermissions || f.allowDangerouslySkipPermissions)
      return 'The runner passes a flag that skips permission checks. Take it out: with it, the bounds stop nothing.';
    if (f.permissionMode === 'bypassPermissions') return 'The runner starts in `bypassPermissions` mode, which skips every check. Use `--permission-mode dontAsk`.';
    if (f.permissionMode !== 'dontAsk')
      return `The runner ${typeof f.permissionMode === 'string' ? `starts in \`${f.permissionMode}\` mode` : 'sets no permission mode'}. Use \`--permission-mode dontAsk\`, so anything not allowed is denied, never asked.`;
    if (typeof f.settings !== 'string' || f.settings.replace(/^\.\//, '') !== 'summer/run/easy-bounds.json')
      return 'The runner doesn\'t pass the easy-read bounds. Use `--settings summer/run/easy-bounds.json`.';
    if (!positive(f.maxTurns)) return 'The runner sets no turn limit. Add `--max-turns` with a whole number.';
    if (!/^\d+$/.test(f.maxTurns)) return '`--max-turns` needs a whole number of turns.';
    if (!positive(f.maxBudgetUsd)) return 'The runner sets no spend limit. Add `--max-budget-usd` with an amount in dollars.';
    if (f.outputFormat !== 'json') return 'The runner doesn\'t ask for a JSON result. Add `--output-format json`, so you can read what the run did and what it was denied.';
    return true;
  },
};

/** @type {Item} */
export const sliceRan = {
  text: 'a slice ran with the bounds as they are now, and cost less than the runner\'s spend limit',
  check(repo) {
    const text = repo.read(RESULT);
    if (text === null) return 'There\'s no slice result yet. Run the slice: `fixit/summer/run/easy-refresh.sh june`.';
    /** @type {unknown} */
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = null;
    }
    if (!isObject(result) || result.type !== 'result')
      return '`summer/run/easy-last-run/result.json` isn\'t the result of a `claude -p` run. Run the slice again: `fixit/summer/run/easy-refresh.sh june`.';
    if (result.session_id === STUB_SESSION) return '`summer/run/easy-last-run/result.json` holds the check\'s stand-in reply. Run the slice again.';
    if (result.subtype !== 'success' || result.is_error === true) {
      const why = result.subtype === 'error_max_budget_usd' ? ' It stopped at the spend limit: is the limit above what one slice costs?' : result.subtype === 'error_max_turns' ? ' It stopped at the turn limit.' : '';
      return `The last slice ended with \`${String(result.subtype)}\`, not \`success\`.${why}`;
    }
    const cost = result.total_cost_usd;
    if (typeof cost !== 'number' || !Number.isFinite(cost)) return 'The slice result has no cost estimate. Run the slice again.';
    const { args } = runnerCall(repo);
    const budget = Number(args?.flags.maxBudgetUsd);
    if (Number.isFinite(budget) && !(cost < budget)) return `The slice cost $${cost}, which isn't under the runner's spend limit of $${budget}.`;
    const used = repo.read(USED);
    if (used === null)
      return 'The slice result has no copy of the bounds it ran with, which the runner saves beside it. Run the slice again with the runner as it was prepared.';
    if (used !== repo.read(BOUNDS))
      return `The last slice ran before ${BOUNDS_NAME} last changed. Run the slice again, so its result shows what these bounds do.`;
    return true;
  },
};

// The Worked example's slice changes one line of the June page; anything
// else is a change the Learner didn't start with.
const SLICED = (/** @type {string} */ page) => page.replace('jobs that need rewiring inside the casing', 'jobs that need mains rewiring inside the casing');

/** @type {Item} */
export const juneKept = {
  text: '`summer/public/june.md` is as it was before Your turn\'s slice',
  check(repo) {
    const page = repo.read(JUNE);
    if (page === null) return '`summer/public/june.md` is missing. Reset this step to bring it back.';
    let start;
    try {
      const first = repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').pop();
      start = repo.gitLocal('show', `${first}:./${JUNE}`);
    } catch {
      return 'The check couldn\'t read how `summer/public/june.md` started. Reset this step and run the check again.';
    }
    // git's output, as the check reads it, has lost the page's last newline.
    if ([start, SLICED(start)].some((s) => `${s}\n` === page)) return true;
    return '`summer/public/june.md` has changed, and the easy-read run wasn\'t asked to touch it. Put it back as it was, and make sure the next run can\'t do the same.';
  },
};

export const items = [boundsNarrow, runnerBounded, sliceRan, juneKept];
