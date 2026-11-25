// @ts-check
// Recover from a partial failure (Fix-It, Advanced lesson 4). The check
// reads the July easy-read page, the record the easy-read runner saved of
// its last run, the pages and files the recovery must leave alone, and the
// Learner's recovery note. The run record is the runner's own files in
// `summer/run/easy-last-run/`: the host keeps no record of its own runs
// yet, so a Learner could write those files by hand, and the lesson says
// so.
import { STUB_SESSION } from '../stub-claude.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Recover from a partial failure';

export const JULY_EASY = 'fixit/summer/public/july-easy.md';
export const RESULT = 'fixit/summer/run/easy-last-run/result.json';
export const REPORT = 'fixit/summer/run/easy-last-run/report.txt';
export const USED = 'fixit/summer/run/easy-last-run/bounds.json';
export const BOUNDS = 'fixit/summer/run/easy-bounds.json';
export const RUNNER = 'fixit/summer/run/easy-refresh.sh';
export const NOTE = 'fixit/summer/a-9/recovery.md';

const EASY = ['july-easy.md', 'august-easy.md'].map((n) => `summer/public/${n}`);

/** @type {(value: unknown) => value is Record<string, any>} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// The file as the lesson started it, from the practice folder's first
// commit; null when the check can't read it. git's output, as the check
// reads it, has lost the file's last newline, so it is put back.
/**
 * @param {Repo} repo
 * @param {string} path
 */
function atStart(repo, path) {
  try {
    const first = repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').pop();
    return `${repo.gitLocal('show', `${first}:./${path}`)}\n`;
  } catch {
    return null;
  }
}

// A line that says there is a lift, or that the room is step-free, with
// nothing on it that says otherwise: a lift out of service, not step-free,
// or a line for someone who needs step-free access.
const LIFT_OUT = /out of service|out of order|not working|isn't working|is broken|no lift|without a lift/i;
const NOT_FREE = /\b(not|isn't|no) step[- ]free\b/i;
const ASKS = /\b(need|needs|if you|call|ask)\b/i;
/** @param {string} line */
const claims = (line) =>
  (/\blift\b/i.test(line) && !LIFT_OUT.test(line)) ||
  (/\bstep[- ]free\b/i.test(line) && !NOT_FREE.test(line) && !ASKS.test(line)) ||
  /\bno steps\b/i.test(line);

/** @type {Item} */
export const julyRight = {
  text: '`july-easy.md` says Room B isn\'t step-free on 10 July, and no longer says there is a lift',
  check(repo) {
    const page = repo.read(JULY_EASY);
    if (page === null) return '`summer/public/july-easy.md` is missing. Reset this step to bring it back.';
    const lines = page.split('\n').filter((l) => !l.startsWith('<!--'));
    const claim = lines.find(claims);
    if (claim)
      return `\`july-easy.md\` still says "${claim.replace(/^[-*]\s*/, '').trim()}". The lift is out of service until at least 20 July, so Room B isn't step-free on 10 July.`;
    if (!lines.some((l) => NOT_FREE.test(l) || LIFT_OUT.test(l)))
      return '`july-easy.md` doesn\'t say that Room B isn\'t step-free. Someone who needs step-free access has to find that on the page.';
    if (!/\b10 July\b/.test(page)) return '`july-easy.md` doesn\'t name 10 July, the day the lift is still out.';
    return true;
  },
};

// The files a run's report lists under "files changed:", from `fixit/`.
/** @param {string} report */
function changedIn(report) {
  const at = report.split('\n').findIndex((l) => l.trim() === 'files changed:');
  if (at < 0) return null;
  const out = [];
  for (const line of report.split('\n').slice(at + 1)) {
    if (!/^\s+\S/.test(line)) break;
    out.push(line.trim());
  }
  return out;
}

const HAND =
  'No run changed `july-easy.md` after the failed one. The recovery should go through the bounded run, so the next refresh doesn\'t undo it.';

/** @type {Item} */
export const recoveryRan = {
  text: 'the last easy-read run, with the bounds as they are now, ended in `success` with no denials, and it changed `july-easy.md` and `august-easy.md`',
  check(repo) {
    const text = repo.read(RESULT);
    if (text === null) return 'There\'s no easy-read run record yet. Run the easy-read refresh: `fixit/summer/run/easy-refresh.sh`.';
    /** @type {unknown} */
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = null;
    }
    if (!isObject(result) || result.type !== 'result')
      return '`summer/run/easy-last-run/result.json` isn\'t the result of a `claude -p` run. Run the recovery with the runner, `fixit/summer/run/easy-refresh.sh`.';
    if (result.session_id === STUB_SESSION) return '`summer/run/easy-last-run/result.json` holds the check\'s stand-in reply. Run the recovery again.';
    const report = repo.read(REPORT);
    const changed = report === null ? null : changedIn(report);
    if (report === null || changed === null)
      return 'The run has no report of the files it changed, which the runner saves beside its result. Run the recovery with the runner as it was prepared.';
    if (!report.includes(`result subtype: ${String(result.subtype)}\n`) || !report.includes(`estimated cost: $${String(result.total_cost_usd)} `))
      return 'The report and the result in `summer/run/easy-last-run/` don\'t describe the same run. Run the recovery with the runner as it was prepared.';
    const [july, august] = EASY;
    const handEdited = !changed.includes(/** @type {string} */ (july)) && atStart(repo, JULY_EASY) !== repo.read(JULY_EASY);
    if (result.subtype !== 'success' || result.is_error === true) {
      if (handEdited) return HAND;
      if (result.subtype === 'error_max_budget_usd')
        return 'The last easy-read run stopped at its spend limit (`error_max_budget_usd`) and didn\'t finish. Rerun only the pages it left undone, with a spend limit that fits them.';
      if (result.subtype === 'error_max_turns') return 'The last easy-read run stopped at its turn limit (`error_max_turns`) and didn\'t finish.';
      return `The last easy-read run ended with \`${String(result.subtype)}\`, not \`success\`. Reset this step, then run the recovery again.`;
    }
    const denials = Array.isArray(result.permission_denials) ? result.permission_denials : [];
    if (denials.length > 0)
      return `The last easy-read run was refused ${denials.length === 1 ? 'a call' : `${denials.length} calls`}, so it may not have done everything it was asked. Read its report: what was it refused?`;
    const used = repo.read(USED);
    if (used === null) return 'The run record has no copy of the bounds it ran with, which the runner saves beside it. Run the recovery with the runner as it was prepared.';
    if (used !== repo.read(BOUNDS))
      return 'The last easy-read run ran before `summer/run/easy-bounds.json` last changed. Run the recovery again, so its record shows what these bounds do.';
    if (handEdited) return HAND;
    for (const page of EASY)
      if (!changed.includes(page))
        return `The last easy-read run didn't change \`${page.replace('summer/public/', '')}\`, which the 08:30 run left undone. Rerun both pages it left in one run, so its record shows the whole recovery.`;
    return true;
  },
};

// The Worked example's rerun changes three lines; anything else on the
// original pages is a change the Learner didn't start Your turn with.
const WHERE = "**Where:** Millbrook Library, Room B (first floor). **Step-free access by lift** next to the children's library.";
const NOT_STEP_FREE =
  '**Where:** Millbrook Library, Room B (first floor). **Not step-free on 10 July:** the lift is out of service until at least 20 July. If you need step-free access, call the events desk on 555-0100.';
/** @type {Record<string, (page: string) => string>} */
export const REFRESHED = {
  'fixit/summer/public/june.md': (p) => p.replace('**Booking:** 32 places.', '**Booking:** 24 places.'),
  'fixit/summer/public/july.md': (p) => p.replace(WHERE, NOT_STEP_FREE),
  'fixit/summer/public/august.md': (p) => p,
  'fixit/summer/public/schedule.md': (p) =>
    p
      .replace('| Sat 12 June | Millbrook Library, Room A | Step-free | 32 |', '| Sat 12 June | Millbrook Library, Room A | Step-free | 24 |')
      .replace('| Sat 10 July | Millbrook Library, Room B | Step-free by lift | 32 |', '| Sat 10 July | Millbrook Library, Room B | Not step-free (lift out of service) | 32 |'),
};

/** @param {unknown} list */
const strings = (list) => (Array.isArray(list) ? list.map(String) : []);

/**
 * Whether `now` gives the run no more than `start` did: no allow rule it
 * didn't have, every deny rule it had, and everything else the same.
 * @param {Record<string, any>} start
 * @param {Record<string, any>} now
 */
function noWider(start, now) {
  const allow = strings(now.permissions?.allow);
  const deny = strings(now.permissions?.deny);
  if (!allow.every((r) => strings(start.permissions?.allow).includes(r))) return false;
  if (!strings(start.permissions?.deny).every((r) => deny.includes(r))) return false;
  const rest = (/** @type {Record<string, any>} */ b) => JSON.stringify({ ...b, permissions: { ...b.permissions, allow: [], deny: [] } });
  return rest(start) === rest(now);
}

/** @type {Item} */
export const othersKept = {
  text: 'the original pages, `easy-bounds.json` and the easy-read runner are as Your turn found them',
  check(repo) {
    for (const [path, refreshed] of Object.entries(REFRESHED)) {
      const page = repo.read(path);
      const name = path.replace('fixit/', '');
      if (page === null) return `\`${name}\` is missing. Reset this step to bring it back.`;
      const start = atStart(repo, path);
      if (start === null) return `The check couldn't read how \`${name}\` started. Reset this step and run the check again.`;
      if (page !== start && page !== refreshed(start))
        return `\`${name}\` has changed, and the easy-read recovery wasn't asked to touch it. Reset this step to put it back, and keep the recovery to the easy-read pages.`;
    }
    const runner = repo.read(RUNNER);
    if (runner === null || runner !== atStart(repo, RUNNER))
      return '`summer/run/easy-refresh.sh` isn\'t as it was prepared. The recovery runs with the prepared runner, so its checks on the bounds still hold. Reset this step to bring it back.';
    const text = repo.read(BOUNDS);
    const start = atStart(repo, BOUNDS);
    /** @type {unknown} */
    let now = null;
    try {
      now = text === null ? null : JSON.parse(text);
    } catch {
      now = null;
    }
    if (!isObject(now) || start === null || !noWider(JSON.parse(start), now))
      return '`summer/run/easy-bounds.json` lets the run do more than it could when Your turn began. The run ran out of money, not permission: keep the same bounds.';
    return true;
  },
};

// A line that names the month's page: the month and "easy" on one line.
/**
 * @param {string} body
 * @param {string} month
 */
const names = (body, month) => body.split('\n').some((l) => new RegExp(`\\b${month}\\b`, 'i').test(l) && /easy/i.test(l));
const SPEND = /\b(budget|spend|spent|spending|cost|costs|money|error_max_budget_usd|max-budget-usd)\b/i;
const LOOKED = /\b(opened|open|compared|compare|checked|check|looked)\b|(?<!easy[- ])\bread\b/i;

/** @type {Item} */
export const noteWritten = {
  text: '`recovery.md` says what stopped the run, which two pages you reran, and how you checked them',
  check(repo) {
    const note = repo.read(NOTE);
    if (note === null) return 'There\'s no `summer/a-9/recovery.md`. Reset this step to bring the note back, then fill it in.';
    // The prepared note's own lines are its headings and its first line.
    const body = note
      .split('\n')
      .filter((l) => !/^#/.test(l) && !l.startsWith('So the next person'))
      .join('\n');
    if (!body.trim()) return '`summer/a-9/recovery.md` is still empty. Under each heading, write a line or two.';
    if (!SPEND.test(body)) return '`recovery.md` doesn\'t say what stopped the run. Was it denied something, or did it run out of money?';
    const missing = ['july', 'august'].find((m) => !names(body, m));
    if (missing) return `\`recovery.md\` doesn't name \`${missing}-easy.md\`. Which two pages did you rerun?`;
    if (!LOOKED.test(body)) return '`recovery.md` doesn\'t say how you checked the result. What did you open or compare?';
    return true;
  },
};

export const items = [julyRight, recoveryRan, othersKept, noteWritten];
