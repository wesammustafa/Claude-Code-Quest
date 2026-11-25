// @ts-check
// From request to commit in code (Fix-It course, the Beginner lab b-3). The
// check gathers its own evidence in the Fix-It group's website repository:
// it runs the link checker on pages it writes to a temporary folder, runs
// the Learner's tests against Ade's flawed `isExternal` and against the
// checker's code from before the missing-folder fix, and reads the commit
// that adds Ade's test and the working tree. Nothing it reads is a file the
// Learner writes as evidence.
//
// In the Fix-It course this file takes the place of the guide's own b-3
// check, whose exports the guide's capstone checks import, so it keeps them:
// NPM_TEST_LIMIT, testRunError, testsPass and nothingUncommitted.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { runCommand } from '../command.mjs';
import { statusPaths } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'From request to commit in code';

// The longest `npm test` may run, in milliseconds.
export const NPM_TEST_LIMIT = 120_000;

const npmTest = (/** @type {string} */ dir) => runCommand('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8', timeout: NPM_TEST_LIMIT });

// A shell lookup or script failure is not evidence of a failing Node test.
// Mutation checks require its TAP/spec failure summary as well as an exit.
/**
 * @param {{ error?: Error, signal: string | null, status: number | null, stdout?: string, stderr?: string }} run spawnSync's result
 * @param {{ requireFailure?: boolean }} [options]
 */
export function testRunError(run, { requireFailure = false } = {}) {
  const completed = !run.error && !run.signal && Number.isInteger(run.status) && /** @type {number} */ (run.status) >= 0;
  if (completed) {
    if (!requireFailure || run.status === 0) return null;
    const output = stripVTControlCharacters(`${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    if (/^[ \t]*(?:#|ℹ)[ \t]+fail[ \t]+[1-9]\d*[ \t\r]*$/m.test(output)) return null;
  }
  const reason = /** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code || run.signal || run.error?.message
    || (completed ? `exit ${run.status}, no failing Node test result` : 'no exit status');
  return `\`npm test\` did not finish (${reason}). Fix the test runner and retry; this does not prove a failing test.`;
}

// The lab runs the website repository's own link checker, so it can't check
// another repository.
/** @param {Repo} repo */
function notWebsite(repo) {
  const missing = ['src/cli.js', 'src/links.js', 'src/check-links.js'].filter((path) => !repo.exists(path));
  return missing.length ? `This folder has no ${missing.map((p) => `\`${p}\``).join(' or ')}. The lab runs the link checker of the Fix-It website repository, so run the check in this lab's practice copy.` : null;
}

/**
 * Runs the repository's link checker on a temporary folder holding `files`
 * (path to text). Its own path is taken out of the output, so no word of it
 * counts.
 * @param {Repo} repo
 * @param {Record<string, string>} files
 */
function runChecker(repo, files) {
  const dir = mkdtempSync(join(tmpdir(), 'b3-links-'));
  try {
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), text);
    }
    const run = spawnSync(process.execPath, [join(repo.dir, 'src', 'cli.js'), dir], { encoding: 'utf8', timeout: 30_000 });
    const strip = (/** @type {string | null | undefined} */ text) => (text ?? '').split(dir).join('');
    return { status: run.status, stdout: strip(run.stdout), stderr: strip(run.stderr) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** @param {{ status: number | null, stderr: string }} run */
function crashed(run) {
  const lines = run.stderr.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => /^[A-Za-z]*Error\b/.test(l)) ?? lines[0];
  return `\`node src/cli.js\` crashed${first ? `: ${first}` : ` (exit code ${run.status})`}. Run \`npm test\`, read the first failure, and ask Claude to fix the code.`;
}

// The targets the checker reports as broken in doc.md, by line. Node also
// exits with 1 when the checker crashes, so a run counts only when it ends
// with the checker's own summary line. Callers return `error` before they
// read `broken`.
/** @typedef {{ error?: string, broken: Map<number, string> }} Broken */

/**
 * @param {Repo} repo
 * @param {Record<string, string>} files
 * @returns {Broken}
 */
function brokenIn(repo, files) {
  const run = runChecker(repo, files);
  if (!/** @type {(number | null)[]} */ ([0, 1]).includes(run.status) || !/^(\d+ broken link\(s\)|All relative links resolve\.)$/m.test(run.stdout))
    return /** @type {Broken} */ ({ error: crashed(run) });
  /** @type {Map<number, string>} */
  const broken = new Map();
  for (const m of run.stdout.matchAll(/^doc\.md:(\d+): broken link to (.*)$/gm)) broken.set(Number(m[1]), /** @type {string} */ (m[2]));
  return { broken };
}

// The test Ade's patch adds, which the lab commits with the fix.
export const PATCH_TEST = 'test/external.test.js';
const PATCH = 'practice/b-3/protocol-relative.patch';

// Whether the last commit holds Ade's test: the Learner committed, so a flaw
// still there gets a more specific hint.
/** @param {Repo} repo */
function patchCommitted(repo) {
  try {
    repo.gitLocal('cat-file', '-e', `HEAD:./${PATCH_TEST}`);
    return true;
  } catch {
    return false;
  }
}

// isExternal as Ade's patch writes it.
const ADE_IS_EXTERNAL = "export function isExternal(target) {\n  return target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target);\n}";
const squash = (/** @type {string} */ text) => text.replace(/\s+/g, '');

// The isExternal function in a src/links.js text, from its declaration to
// the first line that closes it, or null when the file declares none.
/** @param {string} text */
function isExternalIn(text) {
  return text.match(/export\s+function\s+isExternal\b[\s\S]*?\n\}/)?.[0] ?? null;
}

// Ade's isExternal planted over the Learner's src/links.js, which the rest of
// the module still exports.
const PLANTED = `export * from './links.checked.js';
/** @param {string} target */
${ADE_IS_EXTERNAL}
`;

// A copy of the working tree in a temporary folder, without git, the
// dependencies or the checks' saved state, for a mutation run.
/** @param {Repo} repo */
function scratchCopy(repo) {
  const dir = mkdtempSync(join(tmpdir(), 'b3-mutant-'));
  cpSync(repo.dir, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|\.practice)$/.test(src) });
  return dir;
}

/**
 * Whether the Learner's tests fail once `mutate` changes a copy of the
 * working tree: an error to show, `passed` when they still pass on the
 * mutant, or `caught`. They must pass on the copy as it is first.
 * @param {Repo} repo
 * @param {(dir: string) => void} mutate
 * @returns {{ error: string } | { passed: true } | { caught: true }}
 */
function catches(repo, mutate) {
  const dir = scratchCopy(repo);
  try {
    const before = npmTest(dir);
    const beforeError = testRunError(before);
    if (beforeError || before.status !== 0) return { error: beforeError ?? 'The tests fail as they are. Make `npm test` pass first.' };
    mutate(dir);
    const mutant = npmTest(dir);
    const mutantError = testRunError(mutant, { requireFailure: true });
    if (mutantError) return { error: mutantError };
    return mutant.status === 0 ? { passed: true } : { caught: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The commit that adds Ade's test and the files it changes. Later commits
// may edit that test, so it is the commit that adds it, found in the
// history rather than at HEAD. Callers return `error` before they read the
// rest.
/** @typedef {{ error?: string, sha: string, files: string[] }} PatchCommit */

/**
 * @param {Repo} repo
 * @returns {PatchCommit}
 */
function patchCommit(repo) {
  try {
    repo.git('rev-parse', '--verify', '--quiet', 'HEAD^');
  } catch {
    return /** @type {PatchCommit} */ ({ error: 'There is no commit of yours yet. Once the fix and its test are in, ask Claude to commit them together (step 5).' });
  }
  // Each commit against its first parent: a merge's combined diff can omit
  // files changed by only one parent.
  const changed = (/** @type {string} */ rev) => repo.git('diff', '--name-only', `${rev}^`, rev).split('\n').filter(Boolean).map(repo.local);
  const sha = repo.git('log', '-1', '--min-parents=1', '--diff-filter=A', '--format=%H', '--', PATCH_TEST);
  if (!sha) {
    const shown = changed('HEAD').join(', ') || 'no files';
    return /** @type {PatchCommit} */ ({ error: `No commit adds Ade's test, \`${PATCH_TEST}\`, yet; your last commit changes ${shown}. Ask Claude to commit the fix and its test together (step 5).` });
  }
  return { sha, files: changed(sha) };
}

// The checker's code from before the missing-folder fix: the template's
// src/check-links.js and src/cli.js, with the fix's error left without the
// folder's name. A test that checks only that an error is thrown passes on it.
const UNNAMED_CHECK_LINKS = `import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { findLinks, isExternal } from './links.js';

function markdownFiles(root, entry) {
  const path = join(root, entry);
  if (!existsSync(path)) throw new Error('no such file or folder');
  if (statSync(path).isFile()) return path.endsWith('.md') ? [path] : [];
  return readdirSync(path)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .flatMap((name) => markdownFiles(root, join(entry, name)));
}

export function brokenLinks(root, config) {
  const broken = [];
  const files = [...new Set(config.files.flatMap((entry) => markdownFiles(root, entry)))].sort();
  for (const file of files) {
    for (const link of findLinks(readFileSync(file, 'utf8'))) {
      const target = link.target.split('#')[0];
      if (!target || isExternal(link.target)) continue;
      if (config.ignore.some((prefix) => link.target.startsWith(prefix))) continue;
      if (!existsSync(join(dirname(file), decodeURIComponent(target)))) {
        broken.push({ file: relative(root, file), line: link.line, target: link.target });
      }
    }
  }
  return broken;
}
`;
const UNNAMED_CLI = `#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseConfig, DEFAULTS } from './config.js';
import { brokenLinks } from './check-links.js';

const root = resolve(process.argv[2] ?? '.');
const configPath = join(root, 'linkcheck.json');
let config = DEFAULTS;
try {
  if (existsSync(configPath)) config = parseConfig(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(\`linkcheck: \${error.message}\`);
  process.exit(2);
}

let broken;
try {
  broken = brokenLinks(root, config);
} catch (error) {
  console.error(\`linkcheck: \${error.message}\`);
  process.exit(2);
}
for (const b of broken) console.log(\`\${b.file}:\${b.line}: broken link to \${b.target}\`);
console.log(broken.length ? \`\${broken.length} broken link(s)\` : 'All relative links resolve.');
process.exit(broken.length ? 1 : 0);
`;

// The website repository always has an `npm test` script, so no saved exit
// code stands in for a run: the check runs the tests itself.
/** @type {Item} */
export const testsPass = {
  text: 'the tests pass',
  check(repo) {
    const pkg = repo.read('package.json');
    let hasScript = false;
    try { hasScript = Boolean(pkg && JSON.parse(pkg).scripts?.test); } catch { /* not JSON */ }
    if (!hasScript) return 'This repository has no `npm test` script. Put the `test` script in `package.json` back, so the check can run the tests.';
    const run = npmTest(repo.dir);
    const error = testRunError(run);
    return error ? `\`npm test\` fails. ${error}` : run.status === 0 ? true : '`npm test` fails. Run it, read the first failure, and ask Claude to fix the code, not the test.';
  },
};

/** @type {Item} */
export const nothingUncommitted = {
  text: 'nothing is left uncommitted',
  check(repo) {
    const status = statusPaths(repo.git('status', '--porcelain'), repo.prefix);
    // Plain `git stash` leaves new, untracked files behind.
    return status.length ? `These changes are uncommitted: ${status.join(', ')}. Commit them, or set them aside with \`git stash push --include-untracked\`.` : true;
  },
};

/** @type {Item[]} */
export const items = [
  {
    text: 'links with a title, in double or single quotes, are still checked',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const { broken, error } = brokenIn(repo, {
        'setup.md': '# Setup\n',
        'doc.md': '[setup](setup.md "Setting up")\n[gone](gone.md "Old page")\n[old](old.md \'Old page\')\n',
      });
      if (error) return error;
      if (broken.has(1)) return `The checker now reports \`[setup](setup.md "Setting up")\` as a broken link to \`${broken.get(1)}\`, though setup.md exists: a change broke links with a title. Ask Claude to put the link pattern in \`src/links.js\` back, with the tests passing.`;
      /** @type {Record<number, string>} */
      const want = { 2: 'gone.md', 3: 'old.md' };
      const missed = [2, 3].filter((line) => broken.get(line) !== want[line]);
      return missed.length ? 'The checker no longer reads links with a title, such as `[gone](gone.md "Old page")`, as it did: a change broke them. Ask Claude to put the link pattern in `src/links.js` back, with the tests passing.' : true;
    },
  },
  {
    text: 'links such as `//cdn.example.com/app.js` are skipped, and every other link, `/events/fixit-booking.md` included, is checked as before',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const { broken, error } = brokenIn(repo, { 'doc.md': '[app](//cdn.example.com/app.js)\n[booking](/events/fixit-booking.md)\n[root](/missing.md)\n[page](missing.md)\n' });
      if (error) return error;
      if (broken.has(1)) return `The checker still reports \`//cdn.example.com/app.js\` as broken. Apply Ade's patch with \`git apply ${PATCH}\` (step 2), then fix what it gets wrong.`;
      /** @type {Record<number, string>} */
      const links = { 2: '`/events/fixit-booking.md`', 3: '`/missing.md`', 4: '`missing.md`' };
      const skipped = [2, 3, 4].filter((line) => !broken.has(line)).map((line) => links[line]);
      if (!skipped.length) return true;
      const which = skipped.length === 1 ? skipped[0] : `${skipped.slice(0, -1).join(', ')} and ${skipped.at(-1)}`;
      const booking = skipped.includes(links[2] ?? '') ? ' The booking link on the events page would break and nobody would know.' : '';
      if (!patchCommitted(repo)) return `The checker no longer reports ${which}, though Ade's description says every link but the \`//\` ones is checked as before.${booking} Tell Claude which link the patch skips by mistake (step 3).`;
      return `Your commit still skips ${which}.${booking} Fix the rule so only \`//\` links are skipped, with a test that fails on Ade's version, and commit both.`;
    },
  },
  {
    text: 'your tests catch Ade\'s flaw: with his `isExternal` put back, they fail',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const result = catches(repo, (dir) => {
        cpSync(join(dir, 'src', 'links.js'), join(dir, 'src', 'links.checked.js'));
        writeFileSync(join(dir, 'src', 'links.js'), PLANTED);
      });
      if ('error' in result) return result.error;
      if ('caught' in result) return true;
      if (!patchCommitted(repo)) return 'Your tests still pass with Ade\'s `isExternal` put back, so none of them would have caught his patch. Ask Claude for a test that fails on Ade\'s version, on the link his patch skips by mistake (step 3).';
      return 'Your tests still pass with Ade\'s `isExternal` put back: none of them fails on a link his patch skips by mistake. Add a test for that link and commit it.';
    },
  },
  {
    text: 'the commit that adds Ade\'s test, `test/external.test.js`, also holds your change to `isExternal` in `src/links.js`',
    check(repo) {
      const { sha, files, error } = patchCommit(repo);
      if (error) return error;
      const shown = files.join(', ');
      const combine = 'If the fix is in another commit, ask Claude to combine the two into one.';
      if (!files.includes('src/links.js')) return `The commit that adds \`${PATCH_TEST}\` changes nothing in \`src/links.js\` (${shown}), so your fix isn't in it. ${combine}`;
      const show = (/** @type {string} */ rev) => {
        try {
          return repo.gitLocal('show', `${rev}:./src/links.js`);
        } catch {
          return null;
        }
      };
      const at = show(sha);
      if (at === null) return `The commit that adds \`${PATCH_TEST}\` removes \`src/links.js\`. Put the file back and commit your fix to \`isExternal\` with the test.`;
      const fn = isExternalIn(at);
      if (fn !== null && squash(fn) === squash(ADE_IS_EXTERNAL)) return `The commit that adds \`${PATCH_TEST}\` still has Ade's \`isExternal\`, so your fix isn't in it. ${combine}`;
      const before = show(`${sha}^`);
      const was = before === null ? null : isExternalIn(before);
      if (fn !== null && was !== null && squash(fn) === squash(was)) return `The commit that adds \`${PATCH_TEST}\` changes \`src/links.js\` but leaves \`isExternal\` as it was, so the fix isn't in it. ${combine}`;
      return true;
    },
  },
  {
    text: 'that commit changes no file outside `src/links.js` and `test/`',
    check(repo) {
      const { files, error } = patchCommit(repo);
      if (error) return error;
      const extra = files.filter((f) => f !== 'src/links.js' && !f.startsWith('test/'));
      if (!extra.length) return true;
      const list = extra.map((f) => `\`${f}\``).join(', ');
      return `The commit that adds \`${PATCH_TEST}\` also changes ${list}, which the request didn't name. Ask Claude to take ${extra.length === 1 ? 'it' : 'them'} out of the commit and put ${extra.length === 1 ? 'it' : 'them'} back as before.`;
    },
  },
  {
    text: 'a folder in `linkcheck.json` that doesn\'t exist stops the checker with code 2 and an error that names it',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const one = runChecker(repo, { 'linkcheck.json': '{ "files": ["docs"] }\n' });
      if (one.status === null) return crashed(one);
      if (one.status !== 2) return `With \`{ "files": ["docs"] }\` and no \`docs\` folder, the checker exits with code ${one.status}, not 2: Sun-hee's bug is still there. Plan the fix test first (step 6).`;
      if (!/\bdocs\b/.test(`${one.stderr}\n${one.stdout}`)) return 'The checker exits with code 2 for a missing `docs` folder, but its error doesn\'t name the folder. Sun-hee\'s report asks for an error that names it.';
      const two = runChecker(repo, { 'linkcheck.json': '{ "files": ["notes", "archive"] }\n', 'notes/page.md': '# Notes\n' });
      if (two.status === null) return crashed(two);
      if (two.status !== 2) return `With \`{ "files": ["notes", "archive"] }\`, where only \`notes\` exists, the checker exits with code ${two.status}, not 2: the fix misses a missing folder that isn't the first one listed. Ask Claude to check every folder the file lists.`;
      if (!/\barchive\b/.test(`${two.stderr}\n${two.stdout}`)) return 'With `{ "files": ["notes", "archive"] }`, where only `notes` exists, the error doesn\'t name `archive`, the folder that is missing. Ask Claude to name the folder it couldn\'t find.';
      return true;
    },
  },
  {
    text: 'your tests catch Sun-hee\'s bug: with the checker\'s code from the start put back, they fail',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      let root;
      /** @type {string[]} */
      let start;
      try {
        root = /** @type {string} */ (repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').at(-1));
        start = repo.gitLocal('ls-tree', '-r', '--name-only', '--full-name', root, '--', '.').split('\n').filter(Boolean).map(repo.local)
          .filter((f) => f.startsWith('src/') && f !== 'src/links.js');
      } catch {
        return 'This copy has no commit to read the checker\'s starting code from. Run the check in this lab\'s practice copy.';
      }
      const result = catches(repo, (dir) => {
        for (const file of start) writeFileSync(join(dir, file), repo.gitLocal('show', `${root}:./${file}`) + '\n');
      });
      if ('error' in result) return result.error;
      if ('caught' in result) return true;
      return 'Your tests still pass with the checker\'s code from before your fixes, so none of them catches Sun-hee\'s bug. Ask Claude for a test that fails before the fix, and watch it fail first (step 7).';
    },
  },
  {
    text: 'your tests check that the error names the missing folder: with a fix whose error leaves the name out, they fail',
    check(repo) {
      const other = notWebsite(repo);
      if (other) return other;
      const result = catches(repo, (dir) => {
        writeFileSync(join(dir, 'src', 'check-links.js'), UNNAMED_CHECK_LINKS);
        writeFileSync(join(dir, 'src', 'cli.js'), UNNAMED_CLI);
      });
      if ('error' in result) return result.error;
      if ('caught' in result) return true;
      return 'Your tests still pass with a fix whose error leaves out the folder\'s name, so they check only that an error is thrown. Ask Claude to make the test check that the error names the missing folder (step 7).';
    },
  },
  testsPass,
  nothingUncommitted,
];
