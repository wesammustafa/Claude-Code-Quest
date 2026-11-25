// @ts-check
// Script Claude Code with `claude -p` (Fix-It course, the Advanced lab a-4).
// The Learner fills in scripts/review-staged.sh, which pipes the staged diff
// into one `claude -p` call that asks for JSON, runs in dontAsk mode, keeps
// and allows only Read, Grep and Glob, runs no hook or MCP server, caps its
// turns and asks for its findings with --json-schema; the script saves the
// JSON, prints each finding and exits non-zero when the run fails or nothing
// is staged. Then the Learner reviews Sam's comment change with it, rejects
// the finding that is wrong and acts on the one that is right.
//
// The check gathers its own evidence: it runs the committed script with a
// stand-in for `claude`, so it spends no usage; it reads the JSON of one
// real run and finds that run's session where Claude Code keeps each
// session it runs, under ~/.claude/projects/ (in Questerm the simulated
// Claude Code keeps it there too), so JSON written by hand doesn't count;
// and it runs the link checker and the Learner's tests on the committed
// code, and the tests again against Sam's change as it was staged.
//
// In the Fix-It course this file takes the place of the guide's own a-4
// check, whose exports the guide's Advanced capstone check imports, so it
// keeps them: SCRIPT, committedScript, scriptCall, scriptBehavior and
// savedRun, with the same arguments.
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseClaudeArgs, ruleList } from '../claude-args.mjs';
import { runCommand } from '../command.mjs';
import { committedMode, missingJq } from '../hooks.mjs';
import { notRun, runStubbed, stderrTail, STUB_SESSION, TIME_LIMIT } from '../stub-claude.mjs';
/** @import { Ran, Stubbed, Call as StubClaudeCall } from '../stub-claude.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Script Claude Code with `claude -p`';

export const SCRIPT = 'scripts/review-staged.sh';
export const RESULT = '.practice/a-4-result.json';
export const CAP_MAX = 10;

const JQ = 'The script needs `jq`, which isn\'t installed. Install it and run the check again.';
const OUT = 'review.json';
const READ_ONLY = ['Read', 'Grep', 'Glob'];
const TOOL_NAME = /^(?:[A-Z]\w*|mcp__\S+|\*)(\(.*\))?$/s;
const HOOKS_OFF = '`--settings \'{"disableAllHooks": true}\'`';

const and = (/** @type {unknown[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);
const code = (/** @type {string} */ text) => `\`${text}\``;
const quoted = (/** @type {string} */ text) => (text.length > 120 ? `${text.slice(0, 120)}...` : text).replace(/\s+/g, ' ').trim();

/**
 * A JSON value as an object, or null when it isn't one.
 * @param {string} text
 * @returns {Record<string, any> | null}
 */
function jsonObject(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

// What the scratch repository holds, and what the stand-in answers, in each
// run: a review of a staged change; the same without an argument, in a
// repository without `.practice/`, as a fresh copy is; `claude` exiting
// non-zero with an error on stderr and no JSON, as it does for a flag it
// can't read; JSON that says the run failed while `claude` exits 0; and
// nothing staged. The two failures test the script's two exit rules apart.
// Every run but the last has a staged change, and every run a change that
// isn't staged.
/**
 * @typedef {{ review: string, staged: string, unstaged: string }} Markers
 * @typedef {{ stage: boolean, practice?: boolean, args: (out: string) => string[], reply: (m: Markers) => object | null, stderr?: string, exit?: number }} Scenario
 */

// A review with one finding, as a run with the script's schema answers.
const reviewed = (/** @type {Markers} */ m) => {
  const findings = [{ file: 'src/example.js', line: 2, problem: m.review }];
  return { subtype: 'success', is_error: false, result: JSON.stringify({ findings }), structured_output: { findings }, num_turns: 2 };
};

/** @type {Record<string, Scenario>} */
const SCENARIOS = {
  review: { stage: true, args: (out) => [join(out, OUT)], reply: reviewed },
  noArgument: { stage: true, practice: false, args: () => [], reply: reviewed },
  failed: { stage: true, args: (out) => [join(out, OUT)], reply: () => null, stderr: 'error: the stand-in for claude failed before the run', exit: 1 },
  isError: { stage: true, args: (out) => [join(out, OUT)], reply: () => ({ subtype: 'success', is_error: true, result: 'The stand-in reports a failed run.', num_turns: 1 }) },
  nothingStaged: { stage: false, args: (out) => [join(out, OUT)], reply: reviewed },
};

// The most stand-in runs one script gets in one check: one a scenario, kept
// for the items that share it (scenario).
export const STUB_RUNS = Object.keys(SCENARIOS).length;

const README = '# Scratch repository for the practice check\n';
const SOURCE = 'export const answer = 42;\n';

/** @param {string} name */
function plan(name) {
  const id = randomBytes(6).toString('hex');
  // No marker holds another, so each shows on its own.
  const m = { staged: `change-in-the-index-${id}`, unstaged: `change-not-added-${id}`, review: `STUB-REVIEW-${id}` };
  const s = /** @type {Scenario} */ (SCENARIOS[name]);
  const reply = s.reply(m);
  return {
    markers: m,
    options: {
      args: s.args,
      commit: { 'README.md': README, 'src/example.js': SOURCE },
      stage: s.stage ? { 'src/example.js': `${SOURCE}// ${m.staged}\n` } : {},
      change: { 'README.md': `${README}\n${m.unstaged}\n` },
      reply: reply && { type: 'result', session_id: STUB_SESSION, total_cost_usd: 0, permission_denials: [], ...reply },
      stderr: s.stderr,
      exit: s.exit ?? 0,
      practice: s.practice ?? true,
    },
  };
}

/**
 * A stand-in run with its calls read: callers pass it to notRun first, and
 * read the rest only when that finds nothing.
 * @typedef {Ran & Stubbed & { markers: Markers, print: Call[], stray: Call[] }} ScenarioRun
 * @typedef {StubClaudeCall & { args: ReturnType<typeof parseClaudeArgs> }} Call
 */

// Each repository's runs, by script and scenario, so the items share them.
/** @type {WeakMap<Repo, Map<string, ScenarioRun>>} */
const cache = new WeakMap();

/**
 * @param {Repo} repo
 * @param {string} script
 * @param {string} name
 * @returns {ScenarioRun}
 */
function scenario(repo, script, name) {
  if (!cache.has(repo)) cache.set(repo, new Map());
  const runs = /** @type {Map<string, ScenarioRun>} */ (cache.get(repo));
  const key = `${script}\n${name}`;
  if (!runs.has(key)) {
    const { markers, options } = plan(name);
    const run = /** @type {ScenarioRun} */ (runStubbed(repo, script, options));
    const parsed = (run.calls ?? []).map((c) => ({ ...c, args: parseClaudeArgs(c.argv) }));
    run.markers = markers;
    run.print = parsed.filter((c) => c.args.print);
    // Calls without -p, apart from `claude --version` and `claude --help`.
    run.stray = parsed.filter((c) => !c.args.print && !c.args.flags.version && !c.args.flags.help);
    runs.set(key, run);
  }
  return /** @type {ScenarioRun} */ (runs.get(key));
}

/**
 * @param {Repo} repo
 * @param {string} script
 */
function pending(repo, script) {
  try {
    repo.git('diff', '--quiet', 'HEAD', '--', script);
    return '';
  } catch {
    return ` Your copy of ${code(script)} has changes that aren't committed: if they fix this, commit them.`;
  }
}

/**
 * A file as HEAD has it, by its path from this folder, or null.
 * @param {Repo} repo
 * @param {string} path
 */
function committed(repo, path) {
  try {
    return repo.gitLocal('show', `HEAD:./${path}`);
  } catch {
    return null;
  }
}

// A run's exit code, or the signal that ended it.
const exitOf = (/** @type {ScenarioRun} */ run) => run.status ?? run.signal;

const timedOut = `was still running after ${TIME_LIMIT / 1000} seconds, so the check stopped it`;

// How a run ended, for a hint.
/** @param {ScenarioRun} run */
function ended(run) {
  if (run.timedOut) return `It ${timedOut}.`;
  if (missingJq(run)) return JQ;
  const tail = stderrTail(run);
  return `It exited with ${exitOf(run)}${tail ? `: ${tail}` : '.'}`;
}

// The turn cap the script passes, or CAP_MAX when the check can't tell.
/**
 * @param {Repo} repo
 * @param {string} script
 */
function capOf(repo, script) {
  const value = scenario(repo, script, 'review').print?.[0]?.args.flags.maxTurns;
  return /^\d+$/.test(value ?? '') && Number(value) >= 1 ? Number(value) : CAP_MAX;
}

const squash = (/** @type {string} */ flag) => /** @type {string} */ (flag.split('=')[0]).replace(/^-+/, '').replace(/[-_]/g, '').toLowerCase();

/**
 * What the call's settings say, for its hooks: `{ settings }` with the JSON,
 * or `{ problem }`. A file is read as committed, from the folder the script
 * runs in, since the check runs the committed script.
 * @typedef {(path: string) => { text: string | null, uncommitted: boolean }} SettingsFile
 * @param {string} value
 * @param {SettingsFile | undefined} file
 * @returns {{ settings: Record<string, any> } | { problem: string }}
 */
function settingsOf(value, file) {
  const text = value.trim();
  if (text.startsWith('{')) {
    const settings = jsonObject(text);
    return settings ? { settings } : { problem: `\`--settings\` gets ${code(quoted(text))}, which isn't JSON: write ${HOOKS_OFF}.` };
  }
  if (!file) return { problem: `\`--settings\` names ${code(text)}, which the check can't read: write ${HOOKS_OFF}.` };
  const path = posix.normalize(text.replace(/\\/g, '/'));
  if (path.startsWith('/') || path.startsWith('..')) return { problem: `\`--settings\` names ${code(text)}, outside the repository. Commit a settings file in it with the script, or write ${HOOKS_OFF}.` };
  const found = file(path);
  if (found.text === null) return { problem: found.uncommitted ? `\`--settings\` names ${code(path)}, which isn't committed. Commit it with the script: the check reads it as committed.` : `\`--settings\` names ${code(path)}, which isn't in the repository. Save it there and commit it, or write ${HOOKS_OFF}.` };
  const settings = jsonObject(found.text);
  return settings ? { settings } : { problem: `${code(path)}, the file \`--settings\` names, isn't a JSON object: write \`{"disableAllHooks": true}\` in it.` };
}

/**
 * What's wrong with the call's --json-schema, as a sentence, or null.
 * @param {unknown} value
 */
function schemaProblem(value) {
  const pass = 'pass the script\'s schema with `--json-schema "$schema"`';
  if (value === undefined) return `It doesn't ask for its findings in a shape: ${pass}, so the script can print each one.`;
  if (value === null || !String(value).trim()) return `\`--json-schema\` has nothing after it: ${pass}.`;
  const schema = jsonObject(String(value));
  if (!schema) return `\`--json-schema\` gets ${code(quoted(String(value)))}, which isn't a JSON object: ${pass}.`;
  const findings = schema.properties?.findings;
  if (findings?.type !== 'array') return `The schema has no \`findings\` list: ${pass}, which has one.`;
  const fields = findings.items?.properties ?? {};
  const missing = ['file', 'line', 'problem'].filter((k) => !(typeof fields === 'object' && fields && k in fields));
  return missing.length ? `Each finding in the schema lacks ${and(missing.map(code))}: ${pass}, whose findings each have a \`file\`, a \`line\` and a \`problem\`.` : null;
}

/**
 * The words of a tool list that can't be tool names, such as a prompt written
 * after the list, and its tool names.
 * @param {unknown[]} values
 */
function toolWords(values) {
  const kept = values.filter((v) => v !== null && v !== undefined);
  const words = kept.flatMap((v) => ruleList([v]).filter((e) => !TOOL_NAME.test(e)));
  const names = ruleList(kept.filter((v) => ruleList([v]).every((e) => TOOL_NAME.test(e))));
  return { words, names };
}

// The hint for a word of a tool list that isn't a tool name.
/**
 * @param {string} word
 * @param {string} flag
 */
function wordHint(word, flag) {
  return /^(read|grep|glob)$/i.test(word)
    ? `Write ${code(/** @type {string} */ (word[0]).toUpperCase() + word.slice(1).toLowerCase())} as Claude Code spells the tool, not ${code(word)}.`
    : `${code(quoted(word))} isn't one of the review's tools: \`${flag}\` takes a list, so it took that word too. Write the prompt in quotes right after \`-p\`, before the lists.`;
}

/**
 * What's wrong with the arguments of one `claude -p` call, as sentences;
 * none when nothing is. `settingsFile` reads a file `--settings` names, and
 * `apiKey` says whether the script uses ANTHROPIC_API_KEY, which `--bare`
 * needs, since it skips the claude.ai login.
 * @param {string[]} argv
 * @param {{ settingsFile?: SettingsFile, apiKey?: boolean }} [context]
 */
export function callHints(argv, { settingsFile, apiKey = false } = {}) {
  const args = parseClaudeArgs(argv);
  /** @type {string[]} */
  const problems = [];
  // An option Claude Code doesn't know, written like one the call needs.
  const spelling = (/** @type {string} */ flag) => {
    const typo = args.unknown.find((u) => squash(u) === squash(flag));
    return typo ? ` Claude Code doesn't know ${code(/** @type {string} */ (typo.split('=')[0]))}, so it stops with an error before the run starts: write ${code(flag)}.` : '';
  };
  const { outputFormat, permissionMode, allowedTools, tools, maxTurns, dangerouslySkipPermissions, bare } = args.flags;
  const allowed = toolWords(allowedTools ?? []);
  const kept = toolWords(Array.isArray(tools) ? tools : []);
  const swallowed = [...allowed.words, ...kept.words];

  if (args.prompt === undefined) problems.push(swallowed.length ? wordHint(/** @type {string} */ (swallowed[0]), allowed.words.length ? '--allowedTools' : '--tools') : 'The call has no prompt. Write it in quotes right after `-p`, as in `claude -p "<prompt>" --output-format json ...`.');
  else if (!args.prompt.trim()) problems.push('The prompt is empty. Write what Claude should do with the diff there.');
  else if (swallowed.length) problems.push(wordHint(/** @type {string} */ (swallowed[0]), allowed.words.length ? '--allowedTools' : '--tools'));

  if (outputFormat === undefined) problems.push(`It doesn't ask for JSON: add \`--output-format json\`.${spelling('--output-format')}`);
  else if (outputFormat === null) problems.push('`--output-format` has no format after it: write `--output-format json`.');
  else if (outputFormat !== 'json') problems.push(`It asks for \`--output-format ${outputFormat}\`: use \`json\`, so the script can save the result and read it.`);

  if (permissionMode === undefined) problems.push(`It sets no permission mode: add \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.${spelling('--permission-mode')}`);
  else if (permissionMode === null) problems.push('`--permission-mode` has no mode after it: write `--permission-mode dontAsk`.');
  else if (permissionMode.toLowerCase() === 'dontask' && permissionMode !== 'dontAsk') problems.push(`Write \`dontAsk\` as Claude Code spells it, not ${code(permissionMode)}.`);
  else if (permissionMode !== 'dontAsk') problems.push(`It runs in ${code(permissionMode)} mode: use \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.`);
  if (dangerouslySkipPermissions) problems.push('Drop `--dangerously-skip-permissions`: it is the same as `--permission-mode bypassPermissions`.');

  // --tools sets what the run can use at all; --allowedTools what it may
  // use without asking. The review reads files and searches them, so each
  // names exactly the three read tools.
  /**
   * @param {string} flag
   * @param {unknown} value
   * @param {string[]} names
   * @param {string} why
   */
  const exactlyRead = (flag, value, names, why) => {
    if (value === undefined) return `${why}${spelling(flag)}`;
    if (!names.length && !(Array.isArray(value) && value.some((v) => v !== null && ruleList([v]).length))) return `\`${flag}\` lists no tool: write \`${flag} "Read,Grep,Glob"\`.`;
    const others = [...new Set(names.filter((t) => !READ_ONLY.includes(t)))];
    const missing = READ_ONLY.filter((t) => !names.includes(t));
    if (others.length) return `\`${flag}\` names ${and(others.slice(0, 3).map(code))}${others.length > 3 ? ` and ${others.length - 3} more` : ''}: list only \`Read\`, \`Grep\` and \`Glob\` there. Claude gets the diff on stdin, and the review only reads.`;
    if (missing.length) return `\`${flag}\` leaves out ${and(missing.map(code))}: list \`Read\`, \`Grep\` and \`Glob\` there, the three the review reads and searches with.`;
    return null;
  };
  const toolsProblem = exactlyRead('--tools', tools, kept.names, 'It doesn\'t set the tools the run can use: add `--tools "Read,Grep,Glob"`, so Claude can\'t run commands or edit files, even when a rule of yours allows them.');
  const allowedProblem = exactlyRead('--allowedTools', allowedTools, allowed.names, 'It pre-approves no tools: add `--allowedTools "Read,Grep,Glob"`, so the review can read without asking.');
  if (toolsProblem) problems.push(toolsProblem);
  if (allowedProblem) problems.push(allowedProblem);

  // No hooks and no MCP servers but the ones the call passes: a `-p` run
  // runs the project's hooks and connects its `.mcp.json` servers without
  // asking. --bare skips both, and the claude.ai login with them, so it
  // counts only where the script runs with an API key.
  const bareCounts = bare === true && apiKey;
  if (bare === true && !apiKey) problems.push('`--bare` skips the claude.ai login, so its run needs `ANTHROPIC_API_KEY`, which the script never uses. Signed in with a login, as here, turn hooks off with ' + `${HOOKS_OFF} and add \`--strict-mcp-config\` instead.`);
  if (!bareCounts) {
    const { settings } = args.flags;
    if (settings === undefined) problems.push(`It doesn't turn hooks off: add ${HOOKS_OFF}, so the project's hooks can't run in the review.${spelling('--settings')}`);
    else if (settings === null || !settings.trim()) problems.push(`\`--settings\` has nothing after it: write ${HOOKS_OFF}.`);
    else {
      const read = settingsOf(settings, settingsFile);
      if ('problem' in read) problems.push(read.problem);
      else if (read.settings.disableAllHooks !== true) problems.push(`The settings \`--settings\` passes don't set \`"disableAllHooks": true\`, so the project's hooks still run: add it, as in ${HOOKS_OFF}.`);
    }
    if (!args.flags.strictMcpConfig) problems.push(`It doesn't keep the project's MCP servers out: add \`--strict-mcp-config\`, so the run starts no server you didn't pass with \`--mcp-config\`.${spelling('--strict-mcp-config')}`);
  }

  if (maxTurns === undefined) problems.push(`It sets no turn cap: add \`--max-turns\` with a number from 1 to ${CAP_MAX}.${spelling('--max-turns')}`);
  else if (maxTurns === null) problems.push(`\`--max-turns\` has no number after it: write one from 1 to ${CAP_MAX}.`);
  else if (!/^\d+$/.test(maxTurns)) problems.push(`\`--max-turns ${maxTurns}\` isn't a whole number: use one from 1 to ${CAP_MAX}.`);
  else if (Number(maxTurns) < 1 || Number(maxTurns) > CAP_MAX) problems.push(`\`--max-turns ${maxTurns}\` is ${Number(maxTurns) < 1 ? 'below 1' : `above ${CAP_MAX}`}: use a number from 1 to ${CAP_MAX}.`);

  const schema = schemaProblem(args.flags.jsonSchema);
  if (schema) problems.push(`${schema}${args.flags.jsonSchema === undefined ? spelling('--json-schema') : ''}`);
  return problems;
}

// `guide` is where the page describes the script.
/**
 * @param {string} script
 * @returns {Item}
 */
export function committedScript(script, guide = 'Your turn step 1') {
  return {
    text: `${code(script)} is committed and executable`,
    check(repo) {
      const mode = committedMode(repo, script);
      if (mode === null) return repo.exists(script) ? `${code(script)} isn't committed. Run \`git add ${script}\` and commit it.` : `There is no ${code(script)}. Write it as ${guide} describes, then commit it.`;
      if (mode === '100755') return pending(repo, script) ? `${code(script)} has changes that aren't committed. Commit them on their own, with nothing else staged: \`git add ${script}\`, then \`git commit\`.` : true;
      if (mode === '100644') return `${code(script)} isn't executable. Run \`chmod +x ${script}\`, then \`git add ${script}\` and commit (Your turn step 2). On Windows, run \`git update-index --chmod=+x ${script}\` and commit.`;
      return `${code(script)} is committed as ${mode === '120000' ? 'a symbolic link' : 'something other than a file'}. Commit the script file itself, and make it executable.`;
    },
  };
}

/**
 * @param {string} script
 * @returns {Item}
 */
export function scriptCall(script) {
  return {
    text: `its \`claude -p\` call asks for JSON in \`dontAsk\` mode, keeps and allows only \`Read\`, \`Grep\` and \`Glob\`, runs no hook or MCP server, caps turns at ${CAP_MAX} or fewer, and asks for findings with \`--json-schema\``,
    check(repo) {
      const run = scenario(repo, script, 'review');
      const skipped = notRun(run, script);
      if (skipped) return skipped;
      if (!run.print.length) {
        const why = run.stray.length
          ? 'ran `claude` without `-p` (or `--print`), which starts an interactive session. Add `-p`, with the prompt right after it.'
          : `never ran \`claude -p\`, so the check couldn't see its flags. ${ended(run)}`;
        return `With a staged change, ${code(script)} ${why}${pending(repo, script)}`;
      }
      const text = committed(repo, script) ?? '';
      /** @type {SettingsFile} */
      const settingsFile = (path) => {
        const found = committed(repo, path);
        return { text: found, uncommitted: found === null && repo.exists(path) };
      };
      const apiKey = /\bANTHROPIC_API_KEY\b/.test(text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n'));
      if (run.print.some((c) => c.argv.some((a) => /PROMPT GOES HERE|FLAGS_GO_HERE/.test(a)))) return `The call still has the skeleton's placeholders: write your prompt in place of \`PROMPT GOES HERE\` and the flags that bound the run in place of \`FLAGS_GO_HERE\` (Your turn step 1), then commit.${pending(repo, script)}`;
      const problems = [...new Set(run.print.flatMap((c) => callHints(c.argv, { settingsFile, apiKey })))];
      if (!problems.length) return true;
      const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and run the check again.` : '';
      return `${problems.slice(0, 3).join(' ')}${more}${pending(repo, script)}`;
    },
  };
}

const isStubJson = (/** @type {string} */ text) => jsonObject(text)?.session_id === STUB_SESSION;

// The review of a staged change, in a run that finished: one call, the staged
// diff on its stdin and nothing else, exit 0, each finding printed and not the
// raw JSON, and the JSON saved where the first argument says.
/**
 * @param {ScenarioRun} run
 * @param {string} fallback
 */
function reviewProblems(run, fallback) {
  const m = run.markers;
  if (!run.print.length) return [`With a staged change, the script never ran \`claude -p\`. ${ended(run)}`];
  /** @type {string[]} */
  const problems = [];
  if (run.print.length > 1) problems.push(`With one staged change, it ran \`claude -p\` ${run.print.length} times. Run it once, with the whole staged diff on stdin.`);
  if (run.stray.length) problems.push('It also ran `claude` without `-p`, which starts an interactive session. Run only the `claude -p` call.');
  const [call] = /** @type {[Call]} */ (run.print);
  if (!call.stdin.includes(m.staged)) {
    problems.push(call.argv.some((a) => a.includes(m.staged))
      ? 'It puts the diff in the prompt. Pipe it in instead: `git diff --cached | claude -p "<prompt>" ...`.'
      : 'What it piped into `claude -p` doesn\'t hold the staged change. Pipe the staged diff in: `git diff --cached | claude -p "<prompt>" ...`.');
  } else if (call.stdin.includes(m.unstaged)) {
    problems.push('The diff it piped into `claude -p` also holds a change that isn\'t staged. Pipe `git diff --cached`, which holds only what is staged.');
  }
  if (run.status !== 0) problems.push(`With a staged change and a run that succeeded, it exited with ${exitOf(run)}${stderrTail(run) ? ` (${stderrTail(run)})` : ''}. Exit 0 when the review succeeds.`);
  if (run.stdout.includes('"session_id"')) problems.push('It prints the raw JSON. Print each finding instead, as the script\'s last line does with `jq -r`.');
  else if (!run.stdout.includes(m.review)) problems.push('It didn\'t print the findings. Print each one from `structured_output.findings`, as the script\'s last line does with `jq -r`.');
  const saved = run.saved[`out/${OUT}`];
  const save = `Save the output of \`claude -p\` to the path in the first argument, or to ${code(fallback)} without one: \`out="\${1:-${fallback}}"\`, then \`> "$out"\`.`;
  if (saved === undefined) problems.push(run.saved[fallback] !== undefined ? `It saved the JSON to ${code(fallback)}, though its first argument named another path. Use the argument when there is one: \`out="\${1:-${fallback}}"\`.` : `It didn't save the JSON to the path in its first argument. ${save}`);
  else if (!isStubJson(saved)) problems.push('The file at the path in its first argument isn\'t the JSON `claude -p` printed. Save that output unchanged.');
  return problems;
}

/**
 * @param {ScenarioRun} run
 * @param {string} fallback
 */
function defaultProblems(run, fallback) {
  if (run.timedOut) return [`Run without an argument, it ${timedOut}.`];
  const saved = run.saved[fallback];
  if (saved === undefined) {
    const folder = posix.dirname(fallback);
    if (run.stderr.includes(fallback) && /No such file or directory/.test(run.stderr)) return [`Run without an argument in a fresh copy, where ${code(`${folder}/`)} doesn't exist yet, it couldn't write ${code(fallback)}. Create the folder first, as \`mkdir -p "$(dirname "$out")"\` does.`];
    const how = run.status !== 0 ? ` (it exited with ${exitOf(run)}${stderrTail(run) ? `: ${stderrTail(run)}` : ''})` : '';
    return [`Run without an argument, it didn't save the JSON to ${code(fallback)}${how}. Use that path when there is no argument: \`out="\${1:-${fallback}}"\`.`];
  }
  return isStubJson(saved) ? [] : [`Run without an argument, it saved something other than the JSON \`claude -p\` printed to ${code(fallback)}.`];
}

/**
 * @param {ScenarioRun} failed
 * @param {ScenarioRun} isError
 */
function failureProblems(failed, isError) {
  /** @type {string[]} */
  const problems = [];
  if (failed.timedOut) problems.push(`When \`claude -p\` exits non-zero, it ${timedOut}. Exit non-zero too, without waiting or trying again.`);
  else if (failed.status === 0) problems.push('When `claude -p` exits non-zero and prints no JSON, as it does for a flag it can\'t read, it exited 0. Exit non-zero whenever `claude -p` does, as `set -euo pipefail` makes it.');
  if (isError.timedOut) problems.push(`When the JSON says \`"is_error": true\`, it ${timedOut}.`);
  else if (isError.status === 0) problems.push('When the JSON says `"is_error": true` and `claude -p` exits 0, it exited 0. Exit non-zero unless `is_error` is `false` and `subtype` is `success`, as the script\'s `jq -e` line does.');
  return problems;
}

/** @param {ScenarioRun} run */
function emptyProblems(run) {
  if (run.timedOut) return [`With nothing staged, it ${timedOut}.`];
  /** @type {string[]} */
  const problems = [];
  if (run.print.length) problems.push('With nothing staged, it still ran `claude -p`. Test for a staged change first, as `git diff --cached --quiet` does, and stop before calling Claude.');
  if (run.status === 0) problems.push('With nothing staged, it exited 0. Exit non-zero, so whatever runs it can tell that no review ran.');
  if (!`${run.stdout}${run.stderr}`.trim()) problems.push('With nothing staged, it printed nothing. Say that nothing is staged.');
  return problems;
}

// `fallback` is where the script saves the JSON without an argument.
/**
 * @param {string} script
 * @returns {Item}
 */
export function scriptBehavior(script, fallback = RESULT) {
  return {
    text: 'it pipes the staged diff in, saves the JSON where its argument says, prints the findings, exits non-zero when the run fails, and doesn\'t call Claude when nothing is staged',
    check(repo) {
      const review = scenario(repo, script, 'review');
      const skipped = notRun(review, script);
      if (skipped) return skipped;
      if (missingJq(review)) return JQ;
      // A script that hangs on a staged change would hang in every run.
      if (review.timedOut) return `With a staged change, ${code(script)} ${timedOut}.${pending(repo, script)}`;
      const [noArgument, failed, isError, nothingStaged] = /** @type {[ScenarioRun, ScenarioRun, ScenarioRun, ScenarioRun]} */ (['noArgument', 'failed', 'isError', 'nothingStaged'].map((n) => scenario(repo, script, n)));
      if ([noArgument, failed, isError, nothingStaged].some(missingJq)) return JQ;
      const problems = [...reviewProblems(review, fallback), ...defaultProblems(noArgument, fallback), ...failureProblems(failed, isError), ...emptyProblems(nothingStaged)];
      if (!problems.length) return true;
      const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and run the check again.` : '';
      return `${problems.slice(0, 3).join(' ')}${more}${pending(repo, script)}`;
    },
  };
}

// Where Claude Code keeps the sessions it runs, one file per session, named
// by its id, in a folder per project: under CLAUDE_CONFIG_DIR when that is
// set, else ~/.claude/.
function sessionFolders() {
  const roots = [process.env.CLAUDE_CONFIG_DIR, join(homedir(), '.claude')].filter((r) => typeof r === 'string' && r !== '');
  return [...new Set(roots)].map((r) => join(/** @type {string} */ (r), 'projects'));
}

/**
 * Whether Claude Code ran the session `id` on this computer: its file is in
 * one of the project folders.
 * @param {string} id
 */
export function sessionRan(id) {
  if (!/^[\w-]+$/.test(id)) return false;
  for (const projects of sessionFolders()) {
    let folders = [];
    try {
      folders = readdirSync(projects);
    } catch {
      continue;
    }
    if (folders.some((f) => existsSync(join(projects, f, `${id}.jsonl`)))) return true;
  }
  return false;
}

// A real run the Learner saved: a run of the script that succeeded within
// its cap and has findings, whose session Claude Code ran here.
/**
 * @param {string} result
 * @param {string} script
 * @returns {Item}
 */
export function savedRun(result, script) {
  const run = `stage a change and run \`${script}${result === RESULT ? '' : ` ${result}`}\``;
  const again = `Then ${run} again.`;
  return {
    text: `${code(result)} holds a real run of it that succeeded within your cap, with findings`,
    local: true,
    check(repo) {
      const text = repo.read(result);
      if (text === null || !text.trim()) return `There is no ${code(result)} yet: ${run} (Your turn step 3), which saves the JSON there.`;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        return `${code(result)} isn't JSON. Save the output of \`claude -p --output-format json\` there unchanged. ${again}`;
      }
      if (value?.type !== 'result') return `${code(result)} isn't the result of a \`claude -p\` run with \`--output-format json\`. ${again}`;
      if (value.session_id === STUB_SESSION) return `${code(result)} holds the check's stand-in reply, not a real run: your script saved it there while the check ran it. Save the JSON only where the script's first argument says. ${again}`;
      if (value.subtype !== 'success') return `The run in ${code(result)} stopped early (${code(String(value.subtype))}) and holds no review.${value.subtype === 'error_max_turns' ? ` Raise the cap, up to ${CAP_MAX}: the review reads the file it reports on before it answers.` : ''} ${again}`;
      if (value.is_error !== false) return `The run in ${code(result)} failed${typeof value.result === 'string' && value.result.trim() ? `: "${quoted(value.result)}"` : ''}. Fix what it says. ${again}`;
      if (typeof value.session_id !== 'string' || !value.session_id) return `The run in ${code(result)} has no \`session_id\`, so it isn't the JSON \`claude -p\` saves. ${again}`;
      if (!Number.isInteger(value.num_turns) || value.num_turns < 1) return `The run in ${code(result)} has no turn count in \`num_turns\`, so it isn't the JSON \`claude -p\` saves. ${again}`;
      // A script fixed during the review, and not yet committed so that
      // Sam's staged change stays out of that commit, may have run with a
      // cap other than the committed one: any cap the call may set.
      const cap = pending(repo, script) ? CAP_MAX : capOf(repo, script);
      if (value.num_turns > cap) return `The run in ${code(result)} took ${value.num_turns} turns, more than \`--max-turns ${cap}\` allows, so it ran with a higher cap. ${again}`;
      const findings = value.structured_output?.findings;
      if (!Array.isArray(findings)) return `The run in ${code(result)} has no \`structured_output.findings\`, so it ran without the script's \`--json-schema\`. ${again}`;
      if (!findings.length) return `The run in ${code(result)} found nothing to report: review Sam's change, staged from \`practice/a-4/comment-links.patch\` (Your turn step 3). ${again}`;
      if (!sessionRan(value.session_id)) return `No Claude Code session on this computer has the \`session_id\` in ${code(result)}: Claude Code keeps every run it makes under \`~/.claude/projects/\`. Save the JSON your script's run printed, not one written another way. ${again}`;
      return true;
    },
  };
}

// ---- Acting on the review: Sam's change, finished and committed ----------

const LINKS = 'src/links.js';
const PATCH = 'practice/a-4/comment-links.patch';

// src/links.js as the lab starts, and with Sam's change, as it was staged:
// it skips a comment that opens and closes on one line, and checks the
// links in one that spans several.
const BASE_FIND = `export function findLinks(markdown) {
  const links = [];
  let inFence = false;
  markdown.split('\\n').forEach((line, i) => {
    if (/^\\s*(\`\`\`|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    __PROSE__
    // The target may sit in angle brackets and may be followed by a title.
    for (const m of prose.matchAll(/(?<!!)\\[([^\\]]*)\\]\\(\\s*(?:<([^>]*)>|([^)\\s]+))(?:\\s+(?:"[^"]*"|'[^']*'))?\\s*\\)/g)) {
      links.push({ text: m[1], target: m[2] ?? m[3], line: i + 1 });
    }
  });
  return links;
}

export function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}
`;
export const START_LINKS = `// Finds inline Markdown links, [text](target), outside code blocks.\n${BASE_FIND.replace('__PROSE__', "const prose = line.replace(/`[^`]*`/g, '');")}`;
export const STAGED_LINKS = `// Finds inline Markdown links, [text](target), outside code blocks and HTML comments.\n${BASE_FIND.replace('__PROSE__', "// An editor's note in an HTML comment holds no link to check.\n    const prose = line.replace(/<!--.*?-->/g, '').replace(/`[^`]*`/g, '');")}`;

// The longest `npm test` may run, in milliseconds.
const NPM_TEST_LIMIT = 120_000;
const npmTest = (/** @type {string} */ dir) => runCommand('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8', timeout: NPM_TEST_LIMIT });
const finished = (/** @type {{ error?: Error, signal: string | null, status: number | null }} */ run) => !run.error && !run.signal && Number.isInteger(run.status);

// The lab runs the website repository's own code, so it can't check another
// repository.
/** @param {Repo} repo */
function notWebsite(repo) {
  const missing = [LINKS, 'src/cli.js', 'src/check-links.js'].filter((path) => !repo.exists(path));
  return missing.length ? `This folder has no ${missing.map((p) => `\`${p}\``).join(' or ')}. The lab works on the Fix-It website repository, so run the check in this lab's practice copy.` : null;
}

// A page with a link in a comment on one line, one in a comment over
// several, one in a comment inside a line, and two broken links outside
// any comment, at lines 7 and 8.
const PAGE = [
  '# Directions',
  '<!-- Old rota: [rota](one-line-note.md) -->',
  '<!--',
  'Draft directions:',
  '[getting there](several-lines-note.md)',
  '-->',
  'Before <!-- [map](inline-note.md) --> the hall, see [booking](missing-booking.md).',
  '[parking](missing-parking.md)',
  '',
].join('\n');
const IN_COMMENTS = ['one-line-note.md', 'several-lines-note.md', 'inline-note.md'];
const OUTSIDE = new Map([[7, 'missing-booking.md'], [8, 'missing-parking.md']]);

/**
 * The link checker of the copy in `dir`, run on PAGE: the targets it reports
 * by line, or an error.
 * @param {string} dir
 * @returns {{ error: string } | { broken: Map<number, string> }}
 */
function checkPage(dir) {
  const pages = mkdtempSync(join(tmpdir(), 'a4-page-'));
  try {
    writeFileSync(join(pages, 'directions.md'), PAGE);
    const run = spawnSync(process.execPath, [join(dir, 'src', 'cli.js'), pages], { encoding: 'utf8', timeout: 30_000 });
    const out = (run.stdout ?? '').split(pages).join('');
    if (![0, 1].includes(run.status ?? -1) || !/^(\d+ broken link\(s\)|All relative links resolve\.)$/m.test(out)) {
      const lines = (run.stderr ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      const first = lines.find((l) => /^[A-Za-z]*Error\b/.test(l)) ?? lines[0];
      return { error: `\`node src/cli.js\` crashed${first ? `: ${first}` : ` (exit code ${run.status})`}. Run \`npm test\`, read the first failure, and ask Claude to fix the code.` };
    }
    /** @type {Map<number, string>} */
    const broken = new Map();
    for (const m of out.matchAll(/^directions\.md:(\d+): broken link to (.*)$/gm)) broken.set(Number(m[1]), /** @type {string} */ (m[2]));
    return { broken };
  } finally {
    rmSync(pages, { recursive: true, force: true });
  }
}

// A copy of the working tree in a temporary folder, without git, the
// dependencies or the checks' saved state.
/** @param {Repo} repo */
function scratchCopy(repo) {
  const dir = mkdtempSync(join(tmpdir(), 'a4-copy-'));
  cpSync(repo.dir, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|\.practice)$/.test(src) });
  return dir;
}

// The test files' tests, each as its text from one `test(` to the next.
/** @param {string} dir */
function testBlocks(dir) {
  /** @type {string[]} */
  const blocks = [];
  const walk = (/** @type {string} */ d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'fixtures') walk(p);
      } else if (/\.test\.[cm]?js$/.test(e.name)) {
        blocks.push(...readFileSync(p, 'utf8').split(/^(?=\s*test\s*\()/m).slice(1));
      }
    }
  };
  if (existsSync(join(dir, 'test'))) walk(join(dir, 'test'));
  return blocks;
}

// Whether a test's text holds an HTML comment and every one it holds opens
// and closes on one line: no line break, written as \n or as a real one,
// between its `<!--` and its `-->`.
/** @param {string} block */
function oneLineCommentTest(block) {
  const comments = [...block.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => /** @type {string} */ (m[1]));
  return comments.length > 0 && comments.every((c) => !/\\n|\n|\\r|\r/.test(c));
}

/** @returns {Item} */
function actedOnReview() {
  const fix = 'Ask Claude to make the change skip comments over several lines too, with a test for one (Your turn step 5)';
  return {
    text: 'the comment change is committed with a fix for comments over several lines, a test for one, and no second test for a comment on one line',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const head = committed(repo, LINKS);
      const squashed = (/** @type {string | null} */ t) => (t ?? '').replace(/\s+/g, '');
      if (head === null || squashed(head) === squashed(START_LINKS)) {
        const staged = repo.git('diff', '--cached', '--name-only', '--', LINKS);
        return staged
          ? `Sam's change is staged but not committed yet. ${fix}, then commit it all (Your turn step 6).`
          : `No commit changes \`${LINKS}\` yet. Apply and stage Sam's change from \`${PATCH}\` (Your turn step 3), then ${fix.charAt(0).toLowerCase()}${fix.slice(1)}, and commit it all (Your turn step 6).`;
      }
      const loose = repo.git('status', '--porcelain', '--untracked-files=all', '--', 'src', 'test').split('\n').filter(Boolean).map((l) => repo.local(l.slice(3)));
      if (loose.length) return `${and(loose.slice(0, 3).map(code))}${loose.length > 3 ? ` and ${loose.length - 3} more` : ''} ${loose.length > 1 ? 'have' : 'has'} changes that aren't committed. Commit the fix with its test (Your turn step 6), then run the check again.`;

      const dir = scratchCopy(repo);
      try {
        const dupes = testBlocks(dir).filter(oneLineCommentTest).length;
        const second = dupes > 1 ? ` Your tests also test a comment on one line ${dupes} times: the staged change already had that test, in \`test/links.test.js\`, so finding 2 was wrong.` : '';
        const page = checkPage(dir);
        if ('error' in page) return page.error;
        const reported = IN_COMMENTS.filter((t) => [...page.broken.values()].includes(t));
        if (reported.includes('several-lines-note.md')) return `A link inside a comment over several lines is still reported as broken, as finding 1 says.${second} ${fix}, then commit it (Your turn step 6).`;
        if (reported.length) return `A link inside a comment ${reported.includes('one-line-note.md') ? 'on one line' : 'in the middle of a line'} is reported as broken again: the change must skip every comment, on one line or several. ${fix}.`;
        const lost = [...OUTSIDE].filter(([line, t]) => page.broken.get(line) !== t);
        if (lost.length) return `The checker no longer reports a broken link after a comment at its own line: on a page with \`[parking](missing-parking.md)\` on line 8, below a comment over several lines, it ${[...page.broken.values()].includes('missing-parking.md') ? 'gives another line' : 'reports nothing'}. Skip only what is inside the comment, and keep its line breaks, so every other link keeps its line.`;
        const tests = npmTest(dir);
        if (!finished(tests)) return '`npm test` did not finish. Run it, read the first failure, and ask Claude to fix it.';
        if (tests.status !== 0) return '`npm test` fails on what you committed. Run it, read the first failure, and ask Claude to fix it, then commit again.';
        writeFileSync(join(dir, LINKS), STAGED_LINKS);
        const mutant = npmTest(dir);
        if (!finished(mutant)) return '`npm test` did not finish with Sam\'s change as it was staged. Run it, and make sure no test waits forever.';
        if (mutant.status === 0) return `Your tests still pass with Sam's change as it was staged, which skips a comment only on one line, so none of them tests a comment over several lines.${second} Add a test with a link inside a comment over several lines, then commit it (Your turn step 6).`;
        if (second) return `${second.trim()} Keep one test for a comment on one line, and test comments over several lines instead.`;
        return true;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

/** @type {Item[]} */
export const items = [committedScript(SCRIPT), scriptCall(SCRIPT), scriptBehavior(SCRIPT), savedRun(RESULT, SCRIPT), actedOnReview()];
