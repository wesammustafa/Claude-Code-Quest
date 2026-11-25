// @ts-check
// Hooks that fail closed (Fix-It course, the Intermediate lab i-5). The
// Learner puts the guard from practice/i-5/ into .claude/hooks/, registers it
// as a PreToolUse hook for Edit and Write that fails closed ("onFailure":
// "block"), adds an Edit deny rule for secrets/ once a shell write gets past
// the guard, and has Claude write a Stop hook, the test gate, which sends
// Claude back while the tests fail, once (stop_hook_active).
//
// Every item but the first reads the files as they are, so a step can check
// them before the commit; the first holds the three files committed and
// unchanged since, so at the end the others read what the commit holds. The
// gate runs in a copy of the repository with its real `npm test`, which the
// check makes fail with a test of its own that also leaves a mark when it
// runs; the guard runs with the JSON an Edit or a Write call sends. Whether
// the guard blocked an edit and the gate sent Claude back in the Learner's
// session is a self-check: the check sees only that `package-lock.json` and
// `secrets/api.txt` are as the lab started them.
//
// In the Fix-It course this file takes the place of the guide's own i-5
// check, whose only importer is the Check index, so it keeps its exports:
// title and items.
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { committedMode, editWriteScripts, hookWords, listMatcher, matchesEditWrite, missingJq } from '../hooks.mjs';
import { statusPaths } from '../paths.mjs';
import { findBash } from '../stub-claude.mjs';
import { testsPass } from './b-3.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Hooks that fail closed';

const GUARD = '.claude/hooks/protect-files.sh';
const GATE = '.claude/hooks/test-gate.sh';
const SETTINGS = '.claude/settings.json';
const LOCAL = '.claude/settings.local.json';
// The files the guard must protect, and two it must let through.
const PROTECTED = ['package-lock.json', 'secrets/api.txt', '.env'];
const OPEN = ['src/links.js', '.env.example'];
// The files no session should have changed by the end.
const KEPT = ['package-lock.json', 'secrets/api.txt'];

/**
 * A settings file as it is now: missing, its parse error, or its value.
 * @param {Repo} repo
 * @param {string} path
 * @returns {{ missing?: true, value?: any, error?: string }}
 */
function settingsAt(repo, path) {
  const text = repo.read(path);
  if (text === null) return { missing: true };
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: /** @type {Error} */ (error).message };
  }
}

/**
 * The shared settings, or what is wrong with them.
 * @param {Repo} repo
 * @returns {{ value: any } | { fault: string }}
 */
function shared(repo) {
  const { missing, error, value } = settingsAt(repo, SETTINGS);
  if (missing) return { fault: `There is no \`${SETTINGS}\`. Run the check in this lab's practice copy.` };
  if (error) return { fault: `\`${SETTINGS}\` is not valid JSON: ${error}. Look for a missing comma between two blocks, or one too many.` };
  return { value };
}

// The groups under `event` in parsed settings, of any shape.
const groupsOf = (/** @type {any} */ settings, /** @type {string} */ event) => (Array.isArray(settings?.hooks?.[event]) ? settings.hooks[event] : []);
const names = (/** @type {any} */ settings, /** @type {string} */ script) =>
  Object.values(settings?.hooks && typeof settings.hooks === 'object' ? settings.hooks : {}).some((gs) => Array.isArray(gs) && gs.some((g) => hookWords(g).includes(script)));

// Whether the local settings file names `script` in a hook, or holds `rule`.
/**
 * @param {Repo} repo
 * @param {(local: any) => boolean} holds
 */
function onlyLocal(repo, holds) {
  const { value } = settingsAt(repo, LOCAL);
  return value !== undefined && holds(value);
}

// Why the settings don't run the guard before Edit and Write, naming the
// part that is wrong: a list matcher, the script's path, the event or the
// matcher.
/** @param {any} settings */
function whyNotGuarded(settings) {
  const not = `\`${SETTINGS}\` doesn't run protect-files.sh`;
  const list = listMatcher(settings);
  if (list) return `${not}: a \`matcher\` under \`${list.event}\` is a list, which stops every hook in the file loading. Write it as one string: \`"matcher": "Edit|Write"\`.`;
  const events = settings?.hooks && typeof settings.hooks === 'object' ? Object.entries(settings.hooks) : [];
  const groups = events.flatMap(([event, gs]) => (Array.isArray(gs) ? gs : []).map((/** @type {any} */ g) => ({ event, group: g, words: hookWords(g) })));
  const named = groups.filter((g) => g.words.includes(GUARD));
  if (!named.length) {
    const elsewhere = groups.flatMap((g) => g.words).find((w) => /(^|\/)protect-files\.\w+$/.test(w));
    if (elsewhere) return `${not}: the hook names \`${elsewhere}\`, and the guard is at \`${GUARD}\`. Use \`"\${CLAUDE_PROJECT_DIR}/${GUARD}"\`.`;
    return `${not}: no hook command names \`${GUARD}\`. Add the \`PreToolUse\` block from Worked example step 2 under \`"hooks"\`.`;
  }
  const pre = named.filter((g) => g.event === 'PreToolUse');
  if (!pre.length) return `${not} before an edit: it is under \`${named.map((g) => g.event).join('`, `')}\`. Move it under \`"PreToolUse"\`, spelled as the lab shows.`;
  const matcher = pre.find((g) => !matchesEditWrite(g.group?.matcher))?.group?.matcher;
  return `${not} for both Edit and Write: the \`matcher\` ${JSON.stringify(matcher)} doesn't match both tool names, so a Write gets past it. Use \`"matcher": "Edit|Write"\`.`;
}

/**
 * Runs the guard as it is now, as Claude Code would before `tool` on
 * `path`, and returns spawnSync's result, or null when there is no guard.
 * @param {Repo} repo
 * @param {string} tool
 * @param {string} path
 */
function runGuard(repo, tool, path) {
  const text = repo.read(GUARD);
  if (text === null) return null;
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  try {
    const file = join(dir, 'protect-files.sh');
    writeFileSync(file, text);
    chmodSync(file, 0o755);
    const root = repo.dir.replace(/\\/g, '/');
    const input = { hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: posix.join(root, path), ...(tool === 'Write' ? { content: 'x\n' } : { old_string: 'a', new_string: 'b' }) } };
    return spawnSync(findBash() ?? 'bash', [file.replace(/\\/g, '/')], {
      cwd: repo.dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10_000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A test of the check's own that fails, and one that passes, each leaving a
// mark when it runs, so the check knows the gate ran the repository's tests.
/**
 * @param {string} mark
 * @param {boolean} fails
 */
const probeTest = (mark, fails) => `import { test } from 'node:test';
import { writeFileSync } from 'node:fs';

test('the check ${fails ? 'breaks this test on purpose' : 'adds this passing test'}', () => {
  writeFileSync(${JSON.stringify(mark)}, 'ran\\n');${fails ? "\n  throw new Error('a test the check broke on purpose');" : ''}
});
`;

/**
 * Runs the gate as it is now, in a copy of the repository's code and tests,
 * as Claude Code would when Claude stops. Returns spawnSync's result and
 * whether the repository's tests ran, or null when there is no gate.
 * @param {Repo} repo
 * @param {{ failing: boolean, retried: boolean }} options
 */
function runGate(repo, { failing, retried }) {
  const text = repo.read(GATE);
  if (text === null) return null;
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    const copy = join(dir, 'repo');
    mkdirSync(copy);
    for (const path of ['package.json', 'src', 'test']) if (repo.exists(path)) cpSync(join(repo.dir, path), join(copy, path), { recursive: true });
    const mark = join(dir, 'ran').replace(/\\/g, '/');
    writeFileSync(join(copy, 'test', 'zz-check-gate.test.js'), probeTest(mark, failing));
    const file = join(dir, 'test-gate.sh');
    writeFileSync(file, text);
    chmodSync(file, 0o755);
    const run = spawnSync(findBash() ?? 'bash', [file.replace(/\\/g, '/')], {
      cwd: copy,
      env: { ...process.env, CLAUDE_PROJECT_DIR: copy.replace(/\\/g, '/') },
      input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: retried, last_assistant_message: 'Done.' }),
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ...run, ranTests: existsSync(mark) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// An Edit deny rule's path, with its anchor (`./`, `/` or none) dropped.
const EDIT_RULE = /^Edit\(\s*(?:\.\/|\/)?([^)]*?)\s*\)$/;
// Paths that cover every file under secrets/, at the root or any depth.
const COVERS = /^(?:\*\*\/)?secrets\/\*\*?$/;
// The rule an `Edit` deny for secrets/ is, if any.
const secretsRule = (/** @type {unknown} */ rule) => {
  const m = typeof rule === 'string' ? rule.trim().match(EDIT_RULE) : null;
  return m ? /** @type {string} */ (m[1]) : null;
};
/** @param {any} settings */
const deniesSecrets = (settings) => (Array.isArray(settings?.permissions?.deny) ? settings.permissions.deny : []).some((r) => COVERS.test(secretsRule(r) ?? ''));

/** @param {Repo} repo */
function startCommit(repo) {
  try {
    return /** @type {string} */ (repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').at(-1));
  } catch {
    return null;
  }
}

/** @type {Item[]} */
export const items = [
  {
    text: 'both hook scripts and `.claude/settings.json` are committed, the scripts executable, with no change to them left uncommitted',
    check(repo) {
      for (const path of [GUARD, GATE, SETTINGS]) {
        const mode = committedMode(repo, path);
        if (mode === null) return repo.exists(path) ? `\`${path}\` is not committed. Commit it with the other hook files (Your turn step 7).` : `There is no \`${path}\`. Put it in place as the lab shows, then commit it.`;
        if (path !== SETTINGS && mode !== '100755') return `\`${path}\` is committed without its executable bit, so Claude Code can't run it. Run \`chmod +x ${path}\`, then commit it again.`;
        if (statusPaths(repo.git('status', '--porcelain', '--', path), repo.prefix).length) return `\`${path}\` has changes that aren't committed yet. Commit them, so the commit holds what you tested (Your turn step 7).`;
      }
      return true;
    },
  },
  {
    text: '`.claude/settings.json` runs protect-files.sh as a `PreToolUse` hook for Edit and Write, with `"onFailure": "block"`',
    check(repo) {
      const s = shared(repo);
      if ('fault' in s) return s.fault;
      if (!editWriteScripts(s.value).includes(GUARD)) {
        if (!names(s.value, GUARD) && onlyLocal(repo, (local) => names(local, GUARD))) return `The guard is registered in \`${LOCAL}\`, which only your sessions read. Move the block into the shared \`${SETTINGS}\`, so everyone who opens the repository gets it.`;
        return whyNotGuarded(s.value);
      }
      // The same scripts, counting only the hook entries that fail closed.
      const closed = groupsOf(s.value, 'PreToolUse').map((/** @type {any} */ g) => ({ ...g, hooks: (Array.isArray(g?.hooks) ? g.hooks : []).filter((/** @type {any} */ h) => h?.onFailure === 'block') }));
      return editWriteScripts({ hooks: { PreToolUse: closed } }).includes(GUARD) ? true : 'Add `"onFailure": "block"` to the protect-files.sh hook, so a guard that can\'t start or crashes blocks the edit instead of letting it through.';
    },
  },
  {
    text: 'the test gate runs the repository\'s tests and exits 2 with a reason while they fail, and 0 once they pass or after one retry',
    check(repo) {
      const failing = runGate(repo, { failing: true, retried: false });
      if (failing === null) return `There is no \`${GATE}\`. Ask Claude to write it (Your turn step 4).`;
      if (failing.error) return `The gate couldn't run: ${failing.error.message}. Run it by hand as Your turn step 5 shows: it should finish within a minute.`;
      if (missingJq(failing)) return 'The gate needs `jq`, which isn\'t installed. Install it and run the check again.';
      if (!failing.ranTests) return `The gate didn't run the repository's tests: the check broke one, and the gate exited ${failing.status} without running it. Run \`npm test\` in the gate, and exit early only when \`stop_hook_active\` is true.`;
      if (failing.status !== 2) return `While the tests fail, the gate exits ${failing.status}, so Claude stops anyway. Exit 2 when \`npm test\` fails.`;
      if (!failing.stderr.trim()) return 'The gate blocks without a reason on stderr. Print why to stderr, so Claude knows what to fix.';
      // The gate is there: the failing run above found it.
      const passing = /** @type {NonNullable<ReturnType<typeof runGate>>} */ (runGate(repo, { failing: false, retried: false }));
      if (passing.status !== 0) {
        return passing.ranTests
          ? `With the tests passing, the gate exits ${passing.status}. Exit 0 then, so Claude can stop. If you broke a test on purpose, put it back first (Your turn steps 5 and 6).`
          : `With the tests passing, the gate exits ${passing.status} before the tests finish. Exit 0 once \`npm test\` passes, so Claude can stop.`;
      }
      const retried = /** @type {NonNullable<ReturnType<typeof runGate>>} */ (runGate(repo, { failing: true, retried: true }));
      if (retried.status !== 0) return 'With `stop_hook_active` true, the gate still blocks, so it could send Claude back again and again. Exit 0 then, so a failure Claude can\'t fix doesn\'t keep it working.';
      return true;
    },
  },
  {
    text: '`.claude/settings.json` runs test-gate.sh as a `Stop` hook',
    check(repo) {
      const s = shared(repo);
      if ('fault' in s) return s.fault;
      // A Stop hook takes no matcher: read its groups as matching every tool.
      const stop = groupsOf(s.value, 'Stop').map((/** @type {any} */ g) => ({ ...g, matcher: '' }));
      if (editWriteScripts({ hooks: { PreToolUse: stop } }).includes(GATE)) return true;
      if (!names(s.value, GATE) && onlyLocal(repo, (local) => names(local, GATE))) return `The gate is registered in \`${LOCAL}\`, which only your sessions read. Move it into the shared \`${SETTINGS}\`.`;
      if (names(s.value, GATE)) return `\`${SETTINGS}\` names test-gate.sh, but not under \`"Stop"\`. A Stop hook runs when Claude finishes; move it there.`;
      return `\`${SETTINGS}\` doesn't run test-gate.sh as a \`Stop\` hook. Add it under \`hooks.Stop\`, as Your turn step 5 shows.`;
    },
  },
  {
    text: 'protect-files.sh exits 2 for an Edit or a Write of `package-lock.json`, `secrets/api.txt` and `.env`, and 0 for `src/links.js` and `.env.example`',
    check(repo) {
      for (const tool of ['Edit', 'Write']) {
        for (const [paths, want] of /** @type {const} */ ([[PROTECTED, 2], [OPEN, 0]])) {
          for (const path of paths) {
            const run = runGuard(repo, tool, path);
            if (run === null) return `There is no \`${GUARD}\`. Copy it from \`practice/i-5/\` (Worked example step 2).`;
            if (run.error || run.status === null) return `protect-files.sh couldn't run: ${run.error?.message ?? `it was stopped by ${run.signal}`}.`;
            if (missingJq(run)) return 'protect-files.sh needs `jq`, which isn\'t installed. Install it and run the check again.';
            if (run.status !== want) {
              const call = `${tool === 'Edit' ? 'an' : 'a'} ${tool}`;
              return want === 2
                ? `For ${call} of \`${path}\`, protect-files.sh exits ${run.status} instead of 2, so that ${tool === 'Edit' ? 'edit' : 'write'} goes through. Put the guard back as \`practice/i-5/protect-files.sh\` has it.`
                : `For ${call} of \`${path}\`, which it doesn't protect, protect-files.sh exits ${run.status} instead of 0, so Claude couldn't change it. Put the guard back as \`practice/i-5/protect-files.sh\` has it.`;
            }
          }
        }
      }
      return true;
    },
  },
  {
    text: '`permissions.deny` in `.claude/settings.json` holds an Edit rule covering `secrets/`',
    check(repo) {
      const s = shared(repo);
      if ('fault' in s) return s.fault;
      if (deniesSecrets(s.value)) return true;
      if (onlyLocal(repo, deniesSecrets)) return `The \`secrets/\` rule is in \`${LOCAL}\`, which only your sessions read. Move it into \`permissions.deny\` in the shared \`${SETTINGS}\`.`;
      const lists = /** @type {const} */ (['allow', 'ask', 'deny']);
      const rules = lists.flatMap((list) => (Array.isArray(s.value?.permissions?.[list]) ? s.value.permissions[list] : []).map((/** @type {unknown} */ r) => ({ list, rule: String(r) })));
      const about = rules.filter(({ rule }) => /secrets/.test(rule));
      const elsewhere = about.find(({ list, rule }) => list !== 'deny' && secretsRule(rule) !== null);
      if (elsewhere) return `\`${elsewhere.rule}\` is under \`${elsewhere.list}\`, not \`deny\`. Move it to \`permissions.deny\`, so nothing can change \`secrets/\`.`;
      const narrow = about.find(({ list, rule }) => list === 'deny' && secretsRule(rule) !== null);
      if (narrow) return `\`${narrow.rule}\` doesn't cover every file in \`secrets/\`. Use \`Edit(./secrets/**)\`.`;
      if (about.some(({ list, rule }) => list === 'deny' && /^Read\(/.test(rule))) return 'A `Read` rule stops Claude reading `secrets/`, not changing it. Add `Edit(./secrets/**)` to `permissions.deny`.';
      if (about.some(({ list, rule }) => list === 'deny' && /^Bash\(/.test(rule))) return 'A `Bash` rule matches a command as it is written, so another command that writes to `secrets/` still gets through. Add `Edit(./secrets/**)` to `permissions.deny`: it also covers the files a shell command writes to.';
      return 'Add `Edit(./secrets/**)` to `permissions.deny` in the shared `.claude/settings.json` (Your turn step 3), so a shell command can\'t write there either.';
    },
  },
  {
    text: '`package-lock.json` and `secrets/api.txt` are as the lab started them',
    check(repo) {
      const start = startCommit(repo);
      if (start === null) return 'There is no commit yet. Run the check in this lab\'s practice copy.';
      for (const path of KEPT) {
        const changed = repo.git('diff', '--name-only', start, '--', path);
        if (!changed) continue;
        const committed = repo.git('diff', '--name-only', start, 'HEAD', '--', path);
        const how = committed ? 'A commit changed it: ask Claude to put it back as the lab\'s first commit has it, and commit that.' : `Put it back with \`git checkout -- ${path}\`.`;
        return path === 'secrets/api.txt'
          ? `\`secrets/api.txt\` has changed since the lab started, as the shell command in Your turn step 3 changed it. ${how}`
          : `\`package-lock.json\` has changed since the lab started, so an edit got past the guard. ${how} Then check that the guard is registered and that you started a new session after registering it (Your turn step 1).`;
      }
      return true;
    },
  },
  testsPass,
];
