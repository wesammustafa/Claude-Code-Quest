// @ts-check
// Model and effort, one variable at a time (Fix-It course, the Intermediate
// lab i-3). The check reads the committed skills' frontmatter against the
// session's default, Opus at medium, finds the commit that first adds an
// entry under `## Unreleased`, and tells which of the three requested changes
// that commit holds by running the checker's code from before and after it on
// pages it writes to a temporary folder. The entry is then read for what that
// change does. Before the commit, the entry is read against the change in the
// working tree, so a Check then catches a wrong entry. Nothing it reads is a
// file the Learner writes as evidence.
//
// In the Fix-It course this file takes the place of the guide's own i-3
// check, whose only importer is the Check index, so it keeps its exports:
// title and items.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { frontmatter } from '../frontmatter.mjs';
import { testsPass } from './b-3.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Model and effort, one variable at a time';

const CHANGELOG_SKILL = '.claude/skills/changelog/SKILL.md';
const FIVE_WHYS = '.claude/skills/five-whys/SKILL.md';
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
// The session's default, which Worked example step 1 shows with /status.
const DEFAULT_EFFORT = 'medium';
// Model aliases and names by size against the default, Opus. `default` and
// `best` are Opus here, and `opusplan` plans on Opus.
const SMALL = /^(?:(?:sonnet|claude-sonnet-[\w.-]+)(?:\[1m\])?|haiku|claude-haiku-[\w.-]+)$/i;
const SAME = /^(?:opus|best|default|opusplan|claude-opus-[\w.-]+)(?:\[1m\])?$/i;
const LARGE = /^(?:fable|claude-fable-[\w.-]+)(?:\[1m\])?$/i;
const TODO = /\bTODO\b/i;

/**
 * A file's text at a commit, or null when the commit doesn't hold it.
 * @param {Repo} repo
 * @param {string} rev
 * @param {string} path
 */
function show(repo, rev, path) {
  try {
    return repo.gitLocal('show', `${rev}:./${path}`);
  } catch {
    return null;
  }
}

const same = (/** @type {string | null} */ a, /** @type {string | null} */ b) => (a ?? '').trimEnd() === (b ?? '').trimEnd();

// The first non-blank line under a `## <heading>` of a Markdown body.
/**
 * @param {string} body
 * @param {string} heading
 */
function lineUnder(body, heading) {
  const lines = body.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (at === -1) return null;
  for (const l of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(l)) return '';
    if (l.trim()) return l.trim();
  }
  return '';
}

// What is wrong with a changelog skill's text, or true.
/** @param {string} text */
function changelogSettings(text) {
  const parsed = frontmatter(text);
  const fields = parsed?.fields ?? {};
  const model = String(fields.model ?? '').trim();
  const effort = String(fields.effort ?? '').trim().toLowerCase();
  if (!model || TODO.test(model)) return 'Set the model in the changelog skill\'s `model:` line: one smaller than the session\'s Opus, or Opus with a lower effort (Your turn step 2).';
  if (!effort || TODO.test(effort)) return 'Set the effort in the changelog skill\'s `effort:` line: lower than the session\'s medium, or medium with a smaller model (Your turn step 2).';
  if (!LEVELS.includes(effort)) return `\`effort: ${effort}\` isn't an effort level. Use one of ${LEVELS.join(', ')}.`;
  if (LARGE.test(model)) return `\`model: ${model}\` is larger than the session's Opus, so the changelog skill would cost more, not less. A one-line entry you review is routine work.`;
  const small = SMALL.test(model);
  if (!small && !SAME.test(model)) return `\`model: ${model}\` isn't a model alias or name Claude Code knows. Use an alias such as \`haiku\`, \`sonnet\` or \`opus\`.`;
  if (LEVELS.indexOf(effort) > LEVELS.indexOf(DEFAULT_EFFORT)) return `\`effort: ${effort}\` is higher than the session's medium, so the changelog skill would think longer than the session does. A one-line entry you review is routine work.`;
  if (!small && effort === DEFAULT_EFFORT) return `With \`model: ${model}\` and \`effort: medium\` the changelog skill runs as the session does, Opus at medium, so it costs no less. Pick a smaller model or a lower effort.`;
  const why = lineUnder(parsed?.body ?? '', 'Why these settings');
  if (why === null) return 'The changelog skill has no heading `## Why these settings`. Put it back, with one line under it on what makes this task routine (Your turn step 2).';
  if (!why || TODO.test(why)) return 'Write one line under `## Why these settings` in the changelog skill: what makes this task routine (Your turn step 2).';
  return true;
}

// What is wrong with a five-whys skill's text, or true.
/** @param {string} text */
function fiveWhysSettings(text) {
  const effort = String(frontmatter(text)?.fields.effort ?? '').trim();
  if (effort === 'high') return true;
  if (effort) return `The five-whys skill runs at \`effort: ${effort}\`. Give it high effort, \`effort: high\`, as Your turn step 1 asks.`;
  return 'Add the effort line `effort: high` inside the frontmatter of `.claude/skills/five-whys/SKILL.md`, between its two `---` lines (Your turn step 1).';
}

/**
 * Judges a skill as committed: true, the fault in the committed file, or
 * that a right version is still uncommitted.
 * @param {Repo} repo
 * @param {string} path
 * @param {(text: string) => true | string} judge
 * @param {string} step
 */
function committedSkill(repo, path, judge, step) {
  const head = show(repo, 'HEAD', path);
  const work = repo.read(path);
  if (head === null) return work === null ? `There is no \`${path}\`. Run the check in this lab's practice copy.` : `\`${path}\` is not committed. Commit it with the change and its entry (Your turn step 4).`;
  const verdict = judge(head);
  if (verdict === true) return true;
  if (work !== null && !same(work, head) && judge(work) === true) return `Your edit to \`${path}\` (${step}) isn't committed yet. Commit it with the change and its entry (Your turn step 4).`;
  return verdict;
}

// The three requests in practice/i-3/requests.md. Each is told by running
// the checker on `pages`: `held` reads its output for the change at work.
/**
 * @typedef {{ id: string, name: string, does: string, pages: Record<string, string>,
 *   held: (out: string) => boolean, named: (entry: string) => boolean }} Change
 */
/** @type {Change[]} */
const CHANGES = [
  {
    id: 'escape',
    name: 'Sun-hee\'s change, a malformed percent escape reported as a broken link',
    does: 'reports a malformed percent escape, such as `bad%.md`, as a broken link instead of crashing',
    pages: { 'doc.md': '# Notes\n\nThe tally is in [the tally](bad%.md).\n' },
    held: (out) => /^doc\.md:3\b.*\bbad%\.md\b/m.test(out),
    named: (entry) => /malformed|percent|escape/i.test(entry) && /broken/i.test(entry),
  },
  {
    id: 'markdown',
    name: 'Tomás\'s change, `.markdown` files checked as well as `.md` ones',
    does: 'checks `.markdown` files as well as `.md` ones',
    pages: { 'page.markdown': '# An old page\n\nSee [the rota](gone.md).\n' },
    held: (out) => /^page\.markdown:3\b.*\bgone\.md\b/m.test(out),
    named: (entry) => /\.markdown\b/i.test(entry),
  },
  {
    id: 'title',
    name: 'Lin\'s change, the page title printed next to each broken link',
    does: 'adds the page title to the output',
    pages: { 'doc.md': '# Fix-It Saturday, 10 April\n\nSee [the rota](gone.md).\n' },
    held: (out) => out.split('\n').some((l) => l.includes('gone.md') && l.includes('Fix-It Saturday, 10 April')),
    named: (entry) => /\btitles?\b/i.test(entry),
  },
];

/**
 * The checker's output (stdout) in folder `code` on `pages`, or null when it
 * crashed: a run counts only when it ends with the checker's own summary.
 * @param {string} code
 * @param {Record<string, string>} pages
 */
function checkerOutput(code, pages) {
  const dir = mkdtempSync(join(tmpdir(), 'i3-pages-'));
  try {
    for (const [name, text] of Object.entries(pages)) writeFileSync(join(dir, name), text);
    const run = spawnSync(process.execPath, [join(code, 'src', 'cli.js'), dir], { encoding: 'utf8', timeout: 30_000 });
    const out = (run.stdout ?? '').split(dir).join('');
    return [0, 1].includes(run.status ?? -1) && /^(\d+ broken link\(s\)|All relative links resolve\.)$/m.test(out) ? out : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The changes code folder `code` holds.
 * @param {string} code
 */
function changesIn(code) {
  return new Set(CHANGES.filter((c) => {
    const out = checkerOutput(code, c.pages);
    return out !== null && c.held(out);
  }).map((c) => c.id));
}

/**
 * The checker's code (src/ and package.json) at commit `rev`, in a
 * temporary folder, passed to `use`.
 * @template T
 * @param {Repo} repo
 * @param {string} rev
 * @param {(dir: string) => T} use
 * @returns {T}
 */
function atCommit(repo, rev, use) {
  const dir = mkdtempSync(join(tmpdir(), 'i3-code-'));
  try {
    const files = repo.gitLocal('ls-tree', '-r', '--name-only', rev, '--', 'src', 'package.json').split('\n').filter(Boolean);
    for (const f of files) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      writeFileSync(join(dir, f), `${repo.gitLocal('show', `${rev}:./${f}`)}\n`);
    }
    return use(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The changes `after`'s code holds that `before`'s doesn't, `after` a commit
 * or null for the working tree.
 * @param {Repo} repo
 * @param {string} before
 * @param {string | null} after
 */
function added(repo, before, after) {
  const was = atCommit(repo, before, changesIn);
  const now = after === null ? changesIn(repo.dir) : atCommit(repo, after, changesIn);
  return CHANGES.filter((c) => now.has(c.id) && !was.has(c.id));
}

// The list items under `## Unreleased` in a CHANGELOG.md text, each without
// its marker.
/** @param {string | null} text */
function unreleased(text) {
  const lines = (text ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+(\[Unreleased\]|Unreleased\b)/i.test(l.trim()));
  if (at === -1) return [];
  const next = lines.slice(at + 1).findIndex((l) => /^#{1,2}\s/.test(l));
  return lines.slice(at + 1, next === -1 ? undefined : at + 1 + next).flatMap((l) => {
    const m = l.match(/^\s*[-*]\s+(\S.*)$/);
    return m ? [/** @type {string} */ (m[1]).trim()] : [];
  });
}

/**
 * The entries under `## Unreleased` in `after` that `before` lacks.
 * @param {string | null} before
 * @param {string | null} after
 */
function newEntries(before, after) {
  const was = new Set(unreleased(before));
  return unreleased(after).filter((e) => !was.has(e));
}

/** @param {Repo} repo */
function startCommit(repo) {
  try {
    return /** @type {string} */ (repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').at(-1));
  } catch {
    return null;
  }
}

/**
 * The first commit after the start that adds an entry under `## Unreleased`,
 * with the changes it holds, or null when no commit does yet.
 * @param {Repo} repo
 * @returns {{ sha: string, held: Change[], files: string[] } | null}
 */
function entryCommit(repo) {
  const shas = repo.git('log', '--reverse', '--min-parents=1', '--format=%H', '--', 'CHANGELOG.md').split('\n').filter(Boolean);
  for (const sha of shas) {
    if (!newEntries(show(repo, `${sha}^`, 'CHANGELOG.md'), show(repo, sha, 'CHANGELOG.md')).length) continue;
    // Against its first parent: a merge's combined diff can omit files.
    const files = repo.git('diff', '--name-only', `${sha}^`, sha).split('\n').filter(Boolean).map(repo.local);
    return { sha, held: added(repo, `${sha}^`, sha), files };
  }
  return null;
}

const names = (/** @type {Change[]} */ cs) => cs.map((c) => c.name).join('; ');
const SPEED = /\b(?:fast|faster|fastest|quicker|quickly|speed|speeds|speedup|speedier|performance)\b/i;

/**
 * What is wrong with the new entries for `change`, or true.
 * @param {string[]} entries
 * @param {Change} change
 */
function entryFor(entries, change) {
  if (entries.some((e) => SPEED.test(e))) return `The entry claims a speed-up; the diff ${change.does}. Correct the entry in \`CHANGELOG.md\` to say what the change does (Your turn step 3).`;
  if (!entries.some(change.named)) {
    const shown = entries.map((e) => `\`- ${e}\``).join(', ');
    return `The entry ${shown} doesn't say what the change does for someone running the checker: it ${change.does}. Correct the entry in \`CHANGELOG.md\` (Your turn step 3).`;
  }
  return true;
}

/** @type {Item[]} */
export const items = [
  {
    text: 'the committed changelog skill runs a smaller model or a lower effort than the session\'s default, Opus at medium, and says why',
    check: (repo) => committedSkill(repo, CHANGELOG_SKILL, changelogSettings, 'Your turn step 2'),
  },
  {
    text: 'the committed five-whys skill runs at `effort: high`',
    check: (repo) => committedSkill(repo, FIVE_WHYS, fiveWhysSettings, 'Your turn step 1'),
  },
  {
    text: 'the commit that adds your changelog entry holds exactly one of the three requested changes',
    check(repo) {
      const at = entryCommit(repo);
      if (at === null) {
        const pending = newEntries(show(repo, 'HEAD', 'CHANGELOG.md'), repo.read('CHANGELOG.md')).length > 0;
        return pending
          ? 'Your changelog entry isn\'t committed yet. Commit it with the change it describes, as one commit (Your turn step 4).'
          : 'No commit adds an entry under `## Unreleased` in `CHANGELOG.md` yet. Make one change, run `/changelog`, and commit the change with its entry (Your turn steps 3 and 4).';
      }
      const short = at.sha.slice(0, 7);
      if (at.held.length === 1) return true;
      if (at.held.length > 1) return `The commit that adds your changelog entry (${short}) holds ${at.held.length} of the three requested changes: ${names(at.held)}. One goes into this release: put the others back, so the entry describes the change beside it.`;
      return `The commit that adds your changelog entry (${short}) holds none of the three requested changes in \`practice/i-3/requests.md\`; it changes ${at.files.join(', ')}. An entry belongs in the same commit as the change it describes: ask Claude to put the change and its entry into one commit (Your turn step 4).`;
    },
  },
  {
    text: 'the new entry under `## Unreleased` says what that change does for someone running the checker, and claims no speed-up the diff doesn\'t make',
    check(repo) {
      const at = entryCommit(repo);
      if (at === null) {
        // Before the commit: the entry in the working tree, against the
        // change the working tree holds.
        const entries = newEntries(show(repo, 'HEAD', 'CHANGELOG.md'), repo.read('CHANGELOG.md'));
        if (!entries.length) return 'There is no new entry under `## Unreleased` in `CHANGELOG.md` yet. Make one change, then run `/changelog` (Your turn step 3).';
        const held = added(repo, 'HEAD', null);
        if (!held.length) return 'The code holds none of the three requested changes yet, so the entry describes nothing. Ask Claude to make one of them first (Your turn step 3).';
        if (held.length > 1) return `The code holds ${held.length} of the three requested changes: ${names(held)}. One goes into this release: ask Claude to put the others back.`;
        return entryFor(entries, /** @type {Change} */ (held[0]));
      }
      if (at.held.length !== 1) return 'Until the commit that adds your entry holds exactly one of the three changes (the item above), the entry can\'t be read against it.';
      const change = /** @type {Change} */ (at.held[0]);
      const start = startCommit(repo);
      const head = show(repo, 'HEAD', 'CHANGELOG.md');
      const entries = newEntries(start === null ? null : show(repo, start, 'CHANGELOG.md'), head);
      if (!entries.length) return 'The committed `CHANGELOG.md` has no entry left under `## Unreleased`. Put the entry back and commit it.';
      const verdict = entryFor(entries, change);
      if (verdict === true) return true;
      const work = newEntries(head, repo.read('CHANGELOG.md'));
      if (work.length && entryFor(unreleased(repo.read('CHANGELOG.md')), change) === true) return 'Your corrected entry isn\'t committed yet. Commit `CHANGELOG.md` (Your turn step 4).';
      return verdict;
    },
  },
  testsPass,
];
