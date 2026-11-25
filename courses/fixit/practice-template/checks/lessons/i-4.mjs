// @ts-check
// Decide what each part may touch (Fix-It, Intermediate lesson 3). The check
// reads fixit/.claude/settings.json, the shared settings Sam's laptop gets,
// and the Learner's own settings.local.json beside it only to say a rule is
// in the wrong file. Rules are matched the way Claude Code matches them, on
// paths a month's folder holds; hooks are run, as Claude Code runs them
// before an Edit or a Write, on test tool calls, and judged by what they do,
// not how they're written. The March guide is read for Priya's number and
// the line the guard let through. Which edits the guard blocked during the
// session is the host's to record (a record no Check reads yet), so the
// guide's content is all this check reads of the probes.
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { findBash } from '../stub-claude.mjs';
import { quote } from './fixit-claims.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Decide what each part may touch';

export const SHARED = 'fixit/.claude/settings.json';
export const LOCAL = 'fixit/.claude/settings.local.json';
export const GUIDE = 'fixit/march/attendee-guide.md';

const MOVE = "Sam won't have it: put it in the shared `.claude/settings.json`.";

/**
 * A settings file's parsed value, null when there is none, or the hint for
 * a file that isn't JSON.
 * @param {Repo} repo
 * @param {string} path
 * @returns {{ value: any } | { error: string }}
 */
function settings(repo, path) {
  const text = repo.read(path);
  if (text === null) return { value: null };
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `\`${path}\` isn't valid JSON (${/** @type {Error} */ (error).message}). Fix it in the files tab, or ask Claude to.` };
  }
}

/** @param {any} value @param {'allow' | 'ask' | 'deny'} list @returns {string[]} */
export const rules = (value, list) => {
  const xs = value?.permissions?.[list];
  return Array.isArray(xs) ? xs.filter((r) => typeof r === 'string') : [];
};

// A rule's tool and its parenthesised specifier, if any.
/** @param {string} rule */
function parseRule(rule) {
  const m = rule.trim().match(/^([\w-]+)(?:\(([\s\S]*)\))?$/);
  return m ? { tool: /** @type {string} */ (m[1]), spec: m[2] } : null;
}

// A gitignore-style pattern as a regular expression over a path below
// fixit/: `**/` matches any folders, `**` anything, `*` and `?` within one
// name.
/** @param {string} pattern */
function globSource(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = /** @type {string} */ (pattern[i]);
    if (c === '*' && pattern[i + 1] === '*') {
      if ((i === 0 || pattern[i - 1] === '/') && pattern[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

// Whether a Read or Edit rule's path covers `path`, a path below fixit/,
// with the permissions docs' anchors: `./` and a bare path from the folder
// the session starts in, `/` from the settings file's project, `//` and `~/`
// outside it. A bare name with no slash matches at any depth; a folder
// covers what is under it.
/** @param {string} spec @param {string} path */
export function covers(spec, path) {
  const raw = spec.trim();
  if (raw.startsWith('//') || raw.startsWith('~')) return false;
  const anchored = raw.startsWith('./') || raw.startsWith('/');
  const p = raw.replace(/^\.?\//, '').replace(/\/$/, '');
  if (!p) return true;
  const anywhere = !anchored && !p.includes('/');
  return new RegExp(`^${anywhere ? '(?:.*/)?' : ''}${globSource(p)}(?:/.*)?$`).test(path);
}

// The first rule of `list` for `tool` that covers `path`: a bare tool name
// covers every path.
/** @param {string[]} list @param {string} tool @param {string} path */
export function ruleFor(list, tool, path) {
  return list.find((rule) => {
    const r = parseRule(rule);
    if (!r || r.tool !== tool) return false;
    return r.spec === undefined || covers(r.spec, path);
  });
}

// Whether a hook matcher fires for `tool`, read as Claude Code reads it
// (hooks reference, "Matcher patterns"): none, `""` or `"*"` fire for every
// tool, a list of names split on `|` or `,` fires for those names exactly,
// anything else is a regular expression.
/** @param {unknown} matcher @param {string} tool */
export function fires(matcher, tool) {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (typeof matcher !== 'string') return false;
  if (/^[\w\- ,|]*$/.test(matcher)) return matcher.split(/[|,]/).map((n) => n.trim()).includes(tool);
  try {
    return new RegExp(matcher).test(tool);
  } catch {
    return false;
  }
}

/**
 * @typedef {{ command: string, args: string[] | null, block: boolean, edit: boolean, write: boolean }} Hook
 */
// A settings file's PreToolUse command hooks, each with the tools it fires for.
/** @param {any} value @returns {Hook[]} */
export function hooksOf(value) {
  const groups = value?.hooks?.PreToolUse;
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((g) =>
    (Array.isArray(g?.hooks) ? g.hooks : [])
      .filter((/** @type {any} */ h) => (h?.type ?? 'command') === 'command' && typeof h?.command === 'string')
      .map((/** @type {any} */ h) => ({
        command: h.command,
        args: Array.isArray(h.args) ? h.args.map(String) : null,
        block: h.onFailure === 'block',
        edit: fires(g?.matcher, 'Edit'),
        write: fires(g?.matcher, 'Write'),
      })),
  );
}

const fixitDir = (/** @type {Repo} */ repo) => join(repo.dir, 'fixit').replace(/\\/g, '/');

// A test tool call as Claude Code hands it to a PreToolUse hook, on `path`
// below fixit/; UNREADABLE is input a guard can't make sense of.
/** @param {Repo} repo @param {'Write' | 'Edit'} tool @param {string} path @param {string} text */
export function call(repo, tool, path, text) {
  const dir = fixitDir(repo);
  const file_path = `${dir}/${path}`;
  return JSON.stringify({
    session_id: 'check',
    hook_event_name: 'PreToolUse',
    cwd: dir,
    tool_name: tool,
    tool_input: tool === 'Edit' ? { file_path, old_string: '**Questions:**', new_string: text } : { file_path, content: text },
  });
}
export const UNREADABLE = '{"tool_name": "Write", "tool_in';

const sq = (/** @type {string} */ s) => `'${s.replace(/'/g, `'\\''`)}'`;

// Each check run's hook results, by repository, hook and input: Questerm
// serves a check's process calls by replaying it, so each runs once.
/** @type {WeakMap<Repo, Map<string, { exit: number | null, stderr: string }>>} */
const runs = new WeakMap();

// Runs `hook` with `input` on stdin, as Claude Code runs a command hook: the
// shell form through bash, the exec form (`args`) with
// `${CLAUDE_PROJECT_DIR}` filled in and no shell, in fixit/, with
// CLAUDE_PROJECT_DIR set. On Windows it runs with Git Bash, as runStubbed
// does. A hook that can't start or times out has a null exit.
/** @param {Repo} repo @param {Hook} hook @param {string} input */
export function run(repo, hook, input) {
  const dir = fixitDir(repo);
  const key = JSON.stringify([hook.command, hook.args, input]);
  const seen = runs.get(repo) ?? new Map();
  runs.set(repo, seen);
  const done = seen.get(key);
  if (done) return done;
  const fill = (/** @type {string} */ s) => s.replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR\b/g, dir);
  const line = hook.args ? [hook.command, ...hook.args].map((w) => sq(fill(w))).join(' ') : hook.command;
  const r = spawnSync(findBash() ?? 'bash', ['-c', line], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input,
    encoding: 'utf8',
    timeout: 10_000,
  });
  const out = { exit: r.error ? null : r.status, stderr: r.stderr ?? '' };
  seen.set(key, out);
  return out;
}

// Whether Claude Code blocks the call after `hook` ran: exit 2 always, any
// other failure only when the hook fails closed.
/** @param {Hook} hook @param {{ exit: number | null }} r */
export const blocks = (hook, r) => r.exit === 2 || (r.exit !== 0 && hook.block);

/** @param {Repo} repo @param {Hook[]} hooks @param {string} input */
export const blockedBy = (repo, hooks, input) => hooks.filter((h) => blocks(h, run(repo, h, input)));

// The script a hook command runs, below fixit/, when it is one of the
// project's own: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/x.sh` and
// `./.claude/hooks/x.sh` are `.claude/hooks/x.sh`.
/** @param {Hook} hook */
function scriptOf(hook) {
  const words = [hook.command, ...(hook.args ?? [])].flatMap((w) => w.split(/\s+/));
  const path = words
    .map((w) => w.replace(/["']/g, '').replace(/^\$\{?CLAUDE_PROJECT_DIR\}?\/?/, '').replace(/^\.\//, ''))
    .find((w) => w.startsWith('.claude/'));
  return path ?? null;
}

// Why Claude Code can't run one of `hooks`, or null when it can: a script
// of the project's that is missing or not executable.
/** @param {Repo} repo @param {Hook[]} hooks */
export function unrunnable(repo, hooks) {
  for (const hook of hooks) {
    const script = scriptOf(hook);
    if (!script) continue;
    let mode;
    try {
      mode = statSync(join(repo.dir, 'fixit', script)).mode;
    } catch {
      return `Your settings run \`${script}\`, but there's no such file in \`fixit/\`. Ask Claude to write it, or fix the path in the settings.`;
    }
    if (process.platform !== 'win32' && (mode & 0o111) === 0) return `\`${script}\` isn't executable, so Claude Code can't run it. Ask Claude to make it executable (\`chmod +x\`).`;
  }
  return null;
}

/** @param {Repo} repo */
function files(repo) {
  const shared = settings(repo, SHARED);
  if ('error' in shared) return { error: shared.error };
  const local = settings(repo, LOCAL);
  if ('error' in local) return { error: local.error };
  return { shared: shared.value, local: local.value };
}
const NONE = (/** @type {string} */ what) => `There's no \`${SHARED}\` yet. ${what}`;

// Paths Claude must never read, and one it must, below fixit/.
const ROSTER = 'march/private/roster.csv';
const NEXT_ROSTER = 'may/private/roster.csv';
const NOTES = 'march/meeting-notes-2027-02-20.md';

/** @type {Item} */
export const privateFolders = {
  text: '`fixit/.claude/settings.json` denies Claude reading any `private/` folder, in any month',
  check(repo) {
    const f = files(repo);
    if ('error' in f) return /** @type {string} */ (f.error);
    const deny = rules(f.shared, 'deny');
    const march = ruleFor(deny, 'Read', ROSTER);
    const next = ruleFor(deny, 'Read', NEXT_ROSTER);
    if (march || next) {
      if (!march || !next) return `\`${march ?? next}\` covers one month's \`private/\` folder only: next month's isn't covered. Match \`private/\` in any folder, such as \`Read(./**/private/**)\`.`;
      const wide = ruleFor(deny, 'Read', NOTES);
      if (wide) return `\`${wide}\` denies more than \`private/\`: Claude can't read \`${NOTES}\` either, and the guide needs it. Deny only the \`private/\` folders.`;
      return true;
    }
    if (ruleFor(rules(f.local, 'deny'), 'Read', ROSTER)) return `The rule for \`private/\` is in your local settings, \`.claude/settings.local.json\`. ${MOVE}`;
    if (f.shared === null) return NONE('Ask Claude for a deny rule that keeps it out of every `private/` folder.');
    return `Nothing stops Claude reading \`${ROSTER}\` yet. Add a deny rule for \`Read\` that matches \`private/\` in any folder, such as \`Read(./**/private/**)\`.`;
  },
};

// What must never change, sources and every month's venue confirmations,
// and what must stay editable, below fixit/.
const PROTECTED = ['sources/flyer-2026-10.md', 'sources/group-notes.md', 'may/booking-confirmation-may.md', 'may/venue-email-may.md'];
const EDITABLE = ['march/facts.md', 'march/attendee-guide.md'];
const PLAIN = 'Doors open at 10:30am.';
const EDIT = 'Edit';

/** @type {Item} */
export const sources = {
  text: 'nothing can change `sources/`, a booking or a venue email, by a shared deny rule or a hook that fails closed, while guides and fact tables stay editable',
  check(repo) {
    const f = files(repo);
    if ('error' in f) return /** @type {string} */ (f.error);
    const deny = rules(f.shared, 'deny');
    const all = hooksOf(f.shared);
    const both = all.filter((h) => h.edit && h.write);
    const broken = unrunnable(repo, both);
    if (broken) return broken;
    /** @param {string} path */
    const denied = (path) => ruleFor(deny, EDIT, path);
    /** @param {string} path */
    const hooked = (path) => (denied(path) ? [] : blockedBy(repo, both, call(repo, 'Write', path, PLAIN)));
    const open = PROTECTED.find((p) => !denied(p) && hooked(p).length === 0);
    if (open) {
      const localDeny = rules(f.local, 'deny');
      if (ruleFor(localDeny, EDIT, open) || blockedBy(repo, hooksOf(f.local), call(repo, 'Write', open, PLAIN)).length) return `The sources rule is in your local settings, \`.claude/settings.local.json\`. ${MOVE}`;
      const editOnly = all.filter((h) => h.edit && !h.write);
      if (blockedBy(repo, editOnly, call(repo, 'Write', open, PLAIN)).length) return `A Write to \`${open}\` wasn't blocked: your hook runs for Edit only. Match \`Edit|Write\`.`;
      if (f.shared === null) return NONE('Ask Claude for a deny rule or a hook that keeps `sources/` and the venue confirmations unchanged.');
      if (PROTECTED.every((p) => !denied(p) && hooked(p).length === 0)) return 'Nothing stops Claude changing `sources/` yet. Ask for Edit deny rules in the shared settings, or a hook on Edit and Write that fails closed.';
      return `\`${open}\` can still be changed. Cover all of \`sources/\` and every month's \`booking-*\` and \`venue-email-*\` files.`;
    }
    for (const path of EDITABLE) {
      const rule = denied(path);
      if (rule) return `\`${rule}\` also stops Claude editing \`${path}\`. Guides and fact tables must stay editable.`;
      if (blockedBy(repo, both, call(repo, 'Write', path, PLAIN)).length) return `Your hook also blocks a Write to \`${path}\`. Guides and fact tables must stay editable.`;
    }
    const guards = [...new Set(PROTECTED.flatMap((p) => hooked(p)))];
    if (guards.some((h) => !h.block)) return 'Your hook for the sources lets an edit through if the script itself can\'t run. Add `"onFailure": "block"` to it, so it fails closed.';
    if (guards.some((h) => run(repo, h, UNREADABLE).exit !== 2)) return "Your hook for the sources lets an edit through when it can't read the input. Make it block then, with exit 2.";
    return true;
  },
};

const PRIYA = 'Questions? Text Priya on 555-0187.';
const LIBRARY = 'Questions? Ring the library on 555-0100.';
const NOTE = 'march/private/notes.md';

/** @type {Item} */
export const numberGuard = {
  text: 'a hook in the shared settings blocks 555-0187 in a Write or Edit to a public page, lets 555-0100 and private notes through, and blocks when it can\'t read the input',
  check(repo) {
    const f = files(repo);
    if ('error' in f) return /** @type {string} */ (f.error);
    const all = hooksOf(f.shared);
    const both = all.filter((h) => h.edit && h.write);
    const broken = unrunnable(repo, both);
    if (broken) return broken;
    const guide = (/** @type {'Write' | 'Edit'} */ tool, /** @type {string} */ text) => call(repo, tool, 'march/attendee-guide.md', text);
    const guards = blockedBy(repo, both, guide('Write', PRIYA));
    if (guards.length === 0) {
      if (blockedBy(repo, all.filter((h) => h.edit && !h.write), guide('Write', PRIYA)).length) return "A Write of 555-0187 to the guide wasn't blocked: match `Edit|Write`.";
      if (blockedBy(repo, hooksOf(f.local), guide('Write', PRIYA)).length) return `The guard is in your local settings, \`.claude/settings.local.json\`. ${MOVE}`;
      if (ruleFor([...rules(f.shared, 'deny'), ...rules(f.local, 'deny')], 'Read', 'sources/flyer-2026-10.md')) return "No guard checks what's written. Denying the flyer hides it, but a number in any other file still gets through.";
      if (f.shared === null) return NONE('Ask Claude for a guard that blocks 555-0187 on a public page.');
      return "No guard checks what's written to a public page yet. Ask Claude for a PreToolUse hook on Edit and Write that blocks 555-0187 there, and blocks if it can't check.";
    }
    if (!guards.some((h) => blocks(h, run(repo, h, guide('Edit', `**Questions:** ${PRIYA}`))))) return "555-0187 edited into the guide wasn't blocked, only written in a whole new file. Make the guard read an edit's new text too.";
    if (!guards.some((h) => h.block)) return 'Your guard lets edits through if the script itself can\'t run. Add `"onFailure": "block"` to its hook, so it fails closed.';
    if (!guards.some((h) => run(repo, h, UNREADABLE).exit === 2)) return "Your guard lets an edit through when it can't read the input. Make it block then, with exit 2.";
    if (blockedBy(repo, both, guide('Write', LIBRARY)).length) return 'Your hooks also block 555-0100, the library\'s public number, on the guide. The guide must still give it.';
    if (guards.every((h) => blocks(h, run(repo, h, call(repo, 'Write', NOTE, PRIYA))))) return `Your guard blocks 555-0187 in \`${NOTE}\`, a private note. Only public pages are guarded.`;
    return true;
  },
};

// A Bash rule that lets more than one command through: the bare tool, or
// any pattern with a wildcard (`Bash(npm *)`, `Bash(npm run *)`, `Bash(*)`).
/** @param {string} rule */
function broad(rule) {
  const r = parseRule(rule);
  return r !== null && r.tool === 'Bash' && (r.spec === undefined || /\*/.test(r.spec));
}
const ASKS = (/** @type {string} */ rule) => {
  const r = parseRule(rule);
  return r !== null && r.tool === 'Bash' && (r.spec === undefined || /^\s*\*+\s*$/.test(r.spec));
};

/** @type {Item} */
export const askFirst = {
  text: 'the shared settings ask before every command, and allow none broader than one',
  check(repo) {
    const f = files(repo);
    if ('error' in f) return /** @type {string} */ (f.error);
    if (f.shared === null) return NONE('Ask Claude to add `Bash` to its `ask` list.');
    if (!rules(f.shared, 'ask').some(ASKS)) return "The shared settings don't ask before commands. Add `Bash` to the `ask` list in `fixit/.claude/settings.json`.";
    const root = (() => {
      try {
        return repo.readAny('.claude/settings.local.json');
      } catch {
        return null;
      }
    })();
    const parsed = (() => {
      try {
        return root === null ? null : JSON.parse(root);
      } catch {
        return null;
      }
    })();
    const wide = [f.shared, f.local, parsed].flatMap((v) => rules(v, 'allow')).find(broad);
    if (wide) return `\`${wide}\` lets every matching command run without asking. Allow one exact command, or none.`;
    return true;
  },
};

const PRIVATE_NUMBER = /555[ .-]?0187/;
const ACCESS_LINE = /questions about access/i;
const PUBLIC_NUMBER = /555[ .-]?0100/;

/** @type {Item} */
export const marchGuide = {
  text: '`fixit/march/attendee-guide.md` has no 555-0187, and has the access line your guard let through',
  check(repo) {
    const text = repo.read(GUIDE);
    if (text === null) return `There's no \`${GUIDE}\`. It's the guide your guard protects: put it back with Reset step.`;
    const lines = text.split(/\r?\n/);
    const leak = lines.find((l) => PRIVATE_NUMBER.test(l));
    if (leak) return `The March guide has 555-0187, Priya's private number: "${quote(leak)}". Remove the line, then make sure your guard blocks it.`;
    if (!lines.some((l) => ACCESS_LINE.test(l) && PUBLIC_NUMBER.test(l))) return "The March guide has no line for access questions with the library's 555-0100 yet. Ask Claude to add it: it's the probe your guard must let through.";
    return true;
  },
};

/** @type {Item[]} */
export const items = [privateFolders, sources, numberGuard, askFirst, marchGuide];
