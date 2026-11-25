// @ts-check
// Parallel worktrees and real merges (Fix-It course, the Advanced lab a-1).
// The Learner ignores .claude/worktrees/ in the copy's committed root
// .gitignore, makes each of Ade's two website jobs in a worktree of its own,
// merges both branches into main and removes the worktrees. The check reads
// git and runs the code: the commits on main that make each job, whether
// they were made on two branches that split, the tests and the link checker
// on main, the Learner's schedule test against a page with a date taken out,
// and the worktrees git still lists. Nothing it reads is a file the Learner
// writes as evidence. That each worktree was a Claude Code session's is what
// the Steps' probes watch while the sessions run; once a worktree is removed
// git keeps no trace of its session, so this check can't see it.
//
// In the Fix-It course this file takes the place of the guide's own a-1
// check, whose exports the guide's Advanced capstone check imports, so it
// keeps them: ignoresWorktrees, and mergedWorktrees, which reads a saved
// `git worktree list --porcelain` listing as the guide's a-1 did.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../command.mjs';
import { committedIgnore, ignoreHint } from '../ignore.mjs';
import { openRepo } from '../repo.mjs';
import { claudeWorktrees, CLAUDE_WORKTREES, liveWorktrees, parseWorktrees } from '../worktrees.mjs';
/** @import { Worktree } from '../worktrees.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Parallel worktrees and real merges';

// Each of Ade's jobs: the worktree its session works in (`claude --worktree
// <name>` makes the branch `worktree-<name>`) and the Step that makes it.
const COMMENTS = { name: 'comments-fix', branch: 'worktree-comments-fix', job: 'the comment fix', step: 1 };
const SCHEDULE = { name: 'schedule-test', branch: 'worktree-schedule-test', job: 'the schedule test', step: 2 };
const LINKS = 'src/links.js';
const PAGE = 'pages/schedule.md';
const DATES = ['Sat 12 June', 'Sat 10 July', 'Sat 14 August'];

// The longest `npm test` may run, in milliseconds.
const NPM_TEST_LIMIT = 120_000;
const npmTest = (/** @type {string} */ dir) => runCommand('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8', timeout: NPM_TEST_LIMIT });
const finished = (/** @type {{ error?: Error, signal: string | null, status: number | null }} */ run) => !run.error && !run.signal && Number.isInteger(run.status);

/**
 * git's answer, or null where it exits non-zero.
 * @param {Repo} repo
 * @param {string[]} args
 */
const ask = (repo, ...args) => {
  try {
    return repo.gitLocal(...args);
  } catch {
    return null;
  }
};
const lines = (/** @type {string | null} */ text) => (text ?? '').split('\n').filter(Boolean);

// The lab runs the website repository's own code, so it can't check another
// repository.
/** @param {Repo} repo */
function notWebsite(repo) {
  const missing = [LINKS, 'src/cli.js', PAGE].filter((path) => !repo.exists(path));
  return missing.length ? `This folder has no ${missing.map((p) => `\`${p}\``).join(' or ')}. The lab works on the Fix-It website repository, so run the check in this lab's practice copy.` : null;
}

// What main's history shows of the two jobs: the newest commit that changes
// src/links.js, the commit that adds a test reading the schedule page, and a
// hint, which is null when both are in HEAD, each from a branch of its own.
/** @typedef {{ comments?: string, schedule?: string, scheduleTest?: string, hint: string | null }} Jobs */

/**
 * @param {Repo} repo
 * @returns {Jobs}
 */
function jobs(repo) {
  const other = notWebsite(repo);
  if (other) return { hint: other };
  if (repo.top.includes(CLAUDE_WORKTREES)) return { hint: `This is a worktree, \`${repo.top}\`. Run the check from your main checkout, where both branches are merged.` };
  const roots = new Set(lines(ask(repo, 'rev-list', '--max-parents=0', 'HEAD')));
  const [root] = roots;
  if (!root) return { hint: 'This repository has no commit yet. Run the check in this lab\'s practice copy.' };
  // The commits since the start that change each job's file, newest first.
  const comments = lines(ask(repo, 'log', '--format=%H', 'HEAD', '--', LINKS)).filter((sha) => !roots.has(sha));
  const added = addedTests(repo, root);
  const scheduleTest = added.find((a) => readsSchedule(repo, a.path));
  /** @type {(sha: string) => string[]} */
  const files = (sha) => lines(ask(repo, 'show', '--name-only', '--format=', sha)).map(repo.local);
  if (!comments.length) return { hint: notMerged(repo, COMMENTS, `\`main\` has no commit that changes \`${LINKS}\` yet`) };
  if (!scheduleTest) return { hint: notMerged(repo, SCHEDULE, `\`main\` has no commit that adds a test in \`test/\` reading \`${PAGE}\` yet`) };
  const schedule = scheduleTest.sha;
  if (comments.includes(schedule)) return { hint: `One commit, ${schedule.slice(0, 7)}, holds both jobs: it changes \`${LINKS}\` and adds \`${scheduleTest.path}\`. Each job belongs on its own worktree's branch, so give each session only its own job (Your turn steps 1 and 2).` };
  const [newest] = /** @type {[string]} */ (comments);
  const fixFiles = new Set(comments.flatMap(files));
  if (fixFiles.has(scheduleTest.path)) return { hint: `The commit that changes \`${LINKS}\` also changes \`${scheduleTest.path}\`, the schedule test's file. Each session should change only its own job's files.` };
  if (files(schedule).includes(LINKS)) return { hint: `The commit that adds \`${scheduleTest.path}\` also changes \`${LINKS}\`, the comment fix's file. Each session should change only its own job's files.` };
  const before = (/** @type {string} */ a, /** @type {string} */ b) => ask(repo, 'merge-base', '--is-ancestor', a, b) !== null;
  if (before(newest, schedule) || before(schedule, newest)) {
    const [first, second] = before(newest, schedule) ? ['the comment fix', 'the schedule test'] : ['the schedule test', 'the comment fix'];
    return { hint: `\`main\` has both jobs, but ${second} was made on top of ${first}, one after the other on one line of history, not on two branches at once. Make each job in its own worktree, started with \`claude --worktree <name>\`, then merge both branches into \`main\`.` };
  }
  return { comments: newest, schedule, scheduleTest: scheduleTest.path, hint: null };
}

// The test files added since `root`, each with the commit that added it,
// newest first, as paths from this folder.
/**
 * @param {Repo} repo
 * @param {string} root
 */
function addedTests(repo, root) {
  /** @type {{ sha: string, path: string }[]} */
  const out = [];
  let sha = '';
  for (const line of lines(ask(repo, 'log', '--diff-filter=A', '--name-only', `${root}..HEAD`))) {
    const commit = /^commit ([0-9a-f]{40,64})\b/.exec(line);
    if (commit) sha = /** @type {string} */ (commit[1]);
    else if (sha && !/^(\s|Author:|Date:|Merge:|commit )/.test(line)) {
      const path = repo.local(line);
      if (/^test\/.*\.test\.[cm]?js$/.test(path)) out.push({ sha, path });
    }
  }
  return out;
}

// Whether a test file in the working tree reads the schedule page.
/**
 * @param {Repo} repo
 * @param {string} path
 */
const readsSchedule = (repo, path) => /schedule\.md/.test(repo.read(path) ?? '');

// Why a job isn't in main yet: its worktree's branch has no commit, or has
// one that isn't merged.
/**
 * @param {Repo} repo
 * @param {typeof COMMENTS} job
 * @param {string} missing
 */
function notMerged(repo, job, missing) {
  const tip = ask(repo, 'rev-parse', '--verify', '--quiet', `refs/heads/${job.branch}`);
  if (!tip) return `${missing}. Start ${job.job}'s session with \`claude --worktree ${job.name}\`, give it its job (Your turn step ${job.step}), have it commit, then merge its branch into \`main\`.`;
  if (Number(ask(repo, 'rev-list', '--count', `HEAD..${job.branch}`) ?? 0) === 0) return `${missing}, and \`${job.branch}\` has no commit of its own. Once you've compared both diffs, tell the session in \`.claude/worktrees/${job.name}\` to commit (Your turn step 3).`;
  return `${missing}: it is on \`${job.branch}\`, which isn't merged. From your main checkout, run \`git merge ${job.branch}\` (Your turn step 4).`;
}

// Runs the repository's link checker on a temporary folder holding one page,
// doc.md, and gives the targets it reports there by line, or an error.
/**
 * @param {Repo} repo
 * @param {string} page
 * @returns {{ error: string } | { broken: Map<number, string> }}
 */
function brokenIn(repo, page) {
  const dir = mkdtempSync(join(tmpdir(), 'a1-links-'));
  try {
    writeFileSync(join(dir, 'doc.md'), page);
    writeFileSync(join(dir, 'setup.md'), '# Setup\n');
    const run = spawnSync(process.execPath, [join(repo.dir, 'src', 'cli.js'), dir], { encoding: 'utf8', timeout: 30_000 });
    const out = (run.stdout ?? '').split(dir).join('');
    if (![0, 1].includes(/** @type {number} */ (run.status)) || !/^(\d+ broken link\(s\)|All relative links resolve\.)$/m.test(out)) {
      const first = lines((run.stderr ?? '').split(dir).join('')).find((l) => /^[A-Za-z]*Error\b/.test(l.trim()));
      return { error: `\`node src/cli.js\` crashed${first ? `: ${first.trim()}` : ''}. Run \`npm test\` on \`main\`, read the first failure, and fix it before you remove the worktrees.` };
    }
    /** @type {Map<number, string>} */
    const broken = new Map();
    for (const m of out.matchAll(/^doc\.md:(\d+): broken link to (.*)$/gm)) broken.set(Number(m[1]), /** @type {string} */ (m[2]));
    return { broken };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// A page with a link in a one-line comment, one in a comment over three
// lines, and broken links outside them: between the two comments, beside a
// link that resolves, and after a comment on its own line.
const COMMENTED = '<!-- [old](old-booking.md) -->\n[between](between.md)\n<!--\n[draft](draft.md)\n-->\n[setup](setup.md) and [gone](gone.md)\n<!-- note --> [after](after.md)\n';
/** @type {Record<number, string>} */
const OUTSIDE = { 2: 'between.md', 6: 'gone.md', 7: 'after.md' };

/** @type {Item} */
const jobsWork = {
  text: 'on `main` the tests pass, a link inside an HTML comment is no longer reported, and the schedule test fails when a summer date is missing from the page',
  check(repo) {
    const { scheduleTest, hint } = jobs(repo);
    if (hint) return hint;
    const scratch = mkdtempSync(join(tmpdir(), 'a1-main-'));
    try {
      cpSync(repo.dir, scratch, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|\.practice)$/.test(src) });
      const run = npmTest(scratch);
      if (!finished(run)) return `\`npm test\` did not finish on \`main\` (${run.error?.message ?? run.signal ?? 'no exit status'}). Run it in the shell and read what it prints.`;
      if (run.status !== 0) return '`npm test` fails on `main` with both branches merged. Run it, read the first failure, and fix it before you remove the worktrees.';
      const links = brokenIn(repo, COMMENTED);
      if ('error' in links) return links.error;
      const inside = [1, 4].filter((n) => links.broken.has(n));
      if (inside.length) return `The link checker on \`main\` still reports ${inside.map((n) => `\`${links.broken.get(n)}\``).join(' and ')}, inside ${inside.length > 1 ? 'HTML comments' : 'an HTML comment'}. The comment fix should skip anything between \`<!--\` and \`-->\`, on one line or several.`;
      const lost = Object.entries(OUTSIDE).filter(([n, target]) => links.broken.get(Number(n)) !== target);
      if (lost.length) return `The link checker on \`main\` no longer reports ${lost.map(([, t]) => `\`${t}\``).join(' and ')}, ${lost.length > 1 ? 'broken links' : 'a broken link'} outside any comment. Skipping comments must leave every other link checked as before: only what sits between \`<!--\` and the next \`-->\` goes.`;
      if (links.broken.size !== Object.keys(OUTSIDE).length) return `The link checker on \`main\` reports ${[...links.broken.values()].map((t) => `\`${t}\``).join(', ')} on a page where only ${Object.values(OUTSIDE).map((t) => `\`${t}\``).join(', ')} are broken. Skipping comments must leave every other link checked as before.`;
      const page = readFileSync(join(scratch, PAGE), 'utf8');
      const missed = [];
      for (const date of DATES) {
        const without = page.split('\n').filter((line) => !line.includes(date)).join('\n');
        writeFileSync(join(scratch, PAGE), without);
        const mutant = npmTest(scratch);
        if (!finished(mutant)) return `\`npm test\` did not finish with ${date} taken out of \`${PAGE}\` (${mutant.error?.message ?? mutant.signal ?? 'no exit status'}).`;
        if (mutant.status === 0) missed.push(date);
      }
      writeFileSync(join(scratch, PAGE), page);
      if (missed.length) return `With ${missed.join(' or ')} taken out of \`${PAGE}\`, the tests still pass, so \`${scheduleTest}\` doesn't check ${missed.length > 1 ? 'those dates' : 'that date'}. The schedule test should check all three summer dates.`;
      return true;
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
};

/** @type {Item} */
const bothMerged = {
  text: '`main` has both jobs, each made on a branch of its own that split from the other: the comment fix in `src/links.js` and a test that reads `pages/schedule.md`, neither changing the other\'s file',
  check: (repo) => jobs(repo).hint ?? true,
};

/** @type {Item} */
const worktreesRemoved = {
  text: 'neither worktree is still there once both branches are merged',
  check(repo) {
    if (jobs(repo).hint) return 'Merge both branches into `main` before you remove either worktree (Your turn step 4): removing a worktree deletes its branch, and with it any commit `main` doesn\'t have.';
    const records = liveWorktrees(repo);
    const main = records[0]?.path ?? '';
    const named = (/** @type {string} */ p) => (main && p.startsWith(`${main}${CLAUDE_WORKTREES}`) ? p.slice(main.length + 1) : p);
    const left = claudeWorktrees(records);
    if (!left.length) return true;
    return left.map((r) => {
      const at = named(r.path);
      if (r.prunable) return `git still lists \`${at}\`, whose folder is gone: run \`git worktree prune\`.`;
      if (typeof r.locked === 'string' && /^"?claude session\b/.test(r.locked)) return `\`${at}\` is still there, and the Claude Code session in it is still running: run \`/exit\` in that session and choose to remove the worktree.`;
      if (r.locked) return `\`${at}\` is still there and locked: run \`git worktree unlock ${at}\`, then \`git worktree remove ${at}\` from your main checkout.`;
      return `\`${at}\` is still there: run \`git worktree remove ${at}\` from your main checkout.`;
    }).join(' ');
  },
};

// `claude --worktree` makes .claude/worktrees/ at the git root, which in a
// copy sits above project/, where the checks run: the rules are asked of
// the root, and the files they name are given from this folder. The shared
// settings may sit in either place. As the guide's a-1 has it.
/** @type {Item} */
export const ignoresWorktrees = {
  text: 'a committed `.gitignore` ignores `.claude/worktrees/` and not the rest of `.claude/`',
  check(repo) {
    const prefix = repo.prefix;
    const root = prefix ? openRepo(repo.top) : repo;
    const worktrees = committedIgnore(root, '.claude/worktrees/a-1-probe/file');
    if (worktrees.problem) {
      const hint = ignoreHint(worktrees.source ? { ...worktrees, source: repo.local(worktrees.source) } : worktrees, '.claude/worktrees/');
      const there = prefix && (worktrees.problem === 'none' || worktrees.problem === 'exclude') ? ` Claude Code makes that folder at the repository root, the folder above \`${prefix}\`, so that \`.gitignore\` is \`${repo.local('.gitignore')}\`.` : '';
      return `${hint}${there}`;
    }
    for (const path of new Set(['.claude/settings.json', `${prefix}.claude/settings.json`])) {
      const settings = committedIgnore(root, path);
      if (settings.problem || settings.source !== worktrees.source) continue;
      return `Line ${settings.line} of \`${repo.local(settings.source)}\`, \`${settings.pattern}\`, also ignores \`${repo.local(path)}\`, so it would hide the settings you share with your team. Ignore only \`.claude/worktrees/\`, and commit.`;
    }
    return true;
  },
};

/** @type {Item[]} */
export const items = [ignoresWorktrees, bothMerged, jobsWork, worktreesRemoved];

// The guide's a-1 check, kept for the guide's Advanced capstone check, which
// imports it: a saved `git worktree list --porcelain` listing names two
// worktrees whose commits split, and both changes are in HEAD.

const save = (/** @type {string} */ snapshot) => `\`git worktree list --porcelain > ${snapshot}\``;
const short = (/** @type {string} */ sha) => sha.slice(0, 7);
const label = (/** @type {Worktree} */ r) => r.branch ?? short(/** @type {string} */ (r.head));

/**
 * @param {Repo} repo
 * @param {string} sha
 */
function isCommit(repo, sha) {
  try {
    repo.gitLocal('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

// `git merge-base --is-ancestor`, remembered: it exits 1 for "no".
/** @param {Repo} repo */
function ancestry(repo) {
  /** @type {Map<string, boolean>} */
  const known = new Map();
  /** @type {(a: string, b: string) => boolean} */
  return (a, b) => {
    const key = `${a} ${b}`;
    if (!known.has(key)) {
      try {
        repo.gitLocal('merge-base', '--is-ancestor', a, b);
        known.set(key, true);
      } catch (error) {
        if (/** @type {{ status?: number | null }} */ (error).status !== 1) throw error;
        known.set(key, false);
      }
    }
    return /** @type {boolean} */ (known.get(key));
  };
}

// The patch-ids `git patch-id --stable` gives for a diff or a log with
// patches, one `<patch-id> <commit>` line each.
/**
 * @param {Repo} repo
 * @param {string} text
 */
function patchIds(repo, text) {
  if (!text.trim()) return [];
  const out = execFileSync('git', ['patch-id', '--stable'], { cwd: repo.dir, input: text, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
  return out.split('\n').filter(Boolean).map((line) => line.split(' ')[0]);
}

// Whether a worktree commit's change is in HEAD: HEAD holds the commit
// itself (a merge or a fast-forward), every commit of its branch as an
// equal patch (a rebase or a cherry-pick), or one commit whose patch is the
// branch's whole change (a squash merge). Remembered per commit.
/**
 * @param {Repo} repo
 * @param {(a: string, b: string) => boolean} isAncestor
 */
function integration(repo, isAncestor) {
  /** @type {Map<string, boolean>} */
  const known = new Map();
  return (/** @type {string} */ sha) => {
    if (!known.has(sha)) known.set(sha, isAncestor(sha, 'HEAD') || copied(repo, sha));
    return /** @type {boolean} */ (known.get(sha));
  };
}

/**
 * @param {Repo} repo
 * @param {string} sha
 */
function copied(repo, sha) {
  try {
    const base = repo.gitLocal('merge-base', sha, 'HEAD');
    if (!base || base === sha) return false;
    // `git cherry` marks with `-` each commit whose patch HEAD already has.
    const marks = repo.gitLocal('cherry', 'HEAD', sha).split('\n').filter(Boolean);
    if (marks.length && marks.every((line) => line.startsWith('-'))) return true;
    const [whole] = patchIds(repo, `${repo.gitLocal('diff', '--no-color', '--no-ext-diff', base, sha)}\n`);
    if (!whole) return false;
    const log = repo.gitLocal('log', '-p', '--no-color', '--no-ext-diff', '--no-merges', '--format=commit %H', `${base}..HEAD`);
    return patchIds(repo, `${log}\n`).includes(whole);
  } catch {
    return false;
  }
}

// What a saved listing shows: the Claude Code worktrees it lists (with
// `anywhere`, every linked worktree, wherever it is), the two whose commits
// split from each other (a merged pair first, as any two pass), and a hint,
// which is null when both changes of that pair are in HEAD.
/**
 * @param {Repo} repo
 * @param {string} snapshot
 * @returns {{ worktrees: Worktree[], pair?: Worktree[], hint: string | null }}
 */
function review(repo, snapshot, anywhere = false) {
  const text = repo.read(snapshot);
  if (text === null || !text.trim()) return { worktrees: [], hint: `While both worktree sessions exist, and after each has committed, run ${save(snapshot)} from your main checkout.` };
  const records = parseWorktrees(text);
  if (!records.length) return { worktrees: [], hint: `\`${snapshot}\` isn't a listing from \`git worktree list --porcelain\`. While both worktrees exist, save it again: ${save(snapshot)}.` };
  const worktrees = anywhere ? records.slice(1).filter((r) => !r.bare) : claudeWorktrees(records);
  if (worktrees.length < 2) {
    if (anywhere) return { worktrees, hint: `\`${snapshot}\` lists ${worktrees.length ? 'one worktree' : 'no worktree'} besides the main checkout. Give each session a worktree of its own, and save ${save(snapshot)} while both worktrees exist.` };
    const others = records.slice(1).filter((r) => !r.bare && !worktrees.includes(r));
    const elsewhere = others.length ? ` It also lists ${others.map((r) => `\`${r.path}\``).join(', ')}, but the check counts only the worktrees \`claude --worktree <name>\` makes, under \`.claude/worktrees/\`.` : '';
    return { worktrees, hint: `\`${snapshot}\` lists ${worktrees.length ? 'one worktree' : 'no worktree'} under \`.claude/worktrees/\`.${elsewhere} Start each session with \`claude --worktree <name>\`, and save ${save(snapshot)} while both worktrees exist.` };
  }
  const known = worktrees.filter((r) => r.head && isCommit(repo, r.head));
  if (known.length < 2) {
    const missing = /** @type {Worktree} */ (worktrees.find((r) => !known.includes(r)));
    const what = missing.head ? `commit ${short(missing.head)}, which isn't in this repository` : `\`${missing.path}\` without a commit`;
    return { worktrees, hint: `\`${snapshot}\` names ${what}. Save the listing from this repository's main checkout, while its worktrees exist: ${save(snapshot)}.` };
  }
  const isAncestor = ancestry(repo);
  const inHead = integration(repo, isAncestor);
  // Every worktree in `known` has a head.
  /** @type {Worktree[][]} */
  const pairs = [];
  for (const [i, a] of known.entries()) {
    for (const b of known.slice(i + 1)) {
      if (a.head !== b.head && !isAncestor(/** @type {string} */ (a.head), /** @type {string} */ (b.head)) && !isAncestor(/** @type {string} */ (b.head), /** @type {string} */ (a.head))) pairs.push([a, b]);
    }
  }
  if (!pairs.length) return { worktrees, hint: `\`${snapshot}\` was saved before both sessions committed: its worktrees point at one commit, or one at an earlier commit of the other's. Save it again before you remove them: ${save(snapshot)}.` };
  const [{ pair, unmerged }] = /** @type {[{ pair: Worktree[], unmerged: Worktree[] }]} */ (pairs
    .map((p) => ({ pair: p, unmerged: p.filter((r) => !inHead(/** @type {string} */ (r.head))) }))
    .sort((x, y) => x.unmerged.length - y.unmerged.length));
  if (!unmerged.length) return { worktrees, pair, hint: null };
  const names = unmerged.map(label);
  return { worktrees, pair, hint: `${names.length > 1 ? 'The changes on' : 'The change on'} ${names.map((n) => `\`${n}\``).join(' and ')} ${names.length > 1 ? "aren't" : "isn't"} in your current branch. From your main checkout, bring ${names.length > 1 ? 'each one' : 'it'} in the way your team does: ${names.map((n) => `\`git merge ${n}\``).join(', then ')}, or a rebase or a squash merge.` };
}

// With `anywhere`, as the Advanced capstone asks, a worktree may sit
// anywhere, not only where `claude --worktree` makes it.
/**
 * @param {string} snapshot
 * @param {{ anywhere?: boolean }} [options]
 * @returns {Item}
 */
export function mergedWorktrees(snapshot, { anywhere = false } = {}) {
  return {
    text: `\`${snapshot}\` lists two worktrees ${anywhere ? 'of this repository' : 'under `.claude/worktrees/`'} whose commits split from each other, and both changes are in your branch`,
    local: true,
    check: (repo) => review(repo, snapshot, anywhere).hint ?? true,
  };
}
