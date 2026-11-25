// @ts-check
// Share the workflow with its limits (Fix-It, Advanced lesson 5). The check
// reads the limits card in the working folder and in the shared (committed)
// version, the note that brings Kofi's call into `summer/`, the August page,
// the records the refresh runner keeps of its runs, and the shared settings.
// The run records are the runner's own files, `summer/run/last-run/` and the
// history `summer/run/runs.txt`: the host keeps no record of its own runs
// yet, so a Learner could write those files by hand, and the lesson says so.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Share the workflow with its limits';

export const CARD = 'fixit/summer/LIMITS.md';
export const AUGUST = 'fixit/summer/public/august.md';
export const RESULT = 'fixit/summer/run/last-run/result.json';
export const REPORT = 'fixit/summer/run/last-run/report.txt';
export const USED = 'fixit/summer/run/last-run/bounds.json';
export const PAGES = 'fixit/summer/run/last-run/pages';
export const HISTORY = 'fixit/summer/run/runs.txt';
export const BOUNDS = 'fixit/summer/run/bounds.json';
export const SETTINGS = 'fixit/.claude/settings.json';
export const LOCAL = 'fixit/.claude/settings.local.json';
const SUMMER = 'fixit/summer';

/** @type {(value: unknown) => value is Record<string, any>} */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** @param {string | null} text */
function parse(text) {
  if (text === null) return null;
  try {
    return /** @type {unknown} */ (JSON.parse(text));
  } catch {
    return null;
  }
}

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

// The file in the shared version, the last commit; null when it isn't there.
/**
 * @param {Repo} repo
 * @param {string} path
 */
function shared(repo, path) {
  try {
    return `${repo.gitLocal('show', `HEAD:./${path}`)}\n`;
  } catch {
    return null;
  }
}

// What a card is missing, as the hint to show, or null when it has every
// part: what the run does, what it can't (unsaved changes and registrations
// among them), who decides and how to stop it, with no claim that it keeps
// the pages in sync with the venues themselves.
const SYNC = /\b(in sync|up to date|current)\b[^.\n]*\bwith\b[^.\n]*\b(venues?|latest confirmations?)\b/i;
const QUALIFIED = /\bsaved\b|summer\/|\bwritten\b|\bnotes?\b/i;
const UNSAVED = /\bphone\b|\bcalls?\b|\binbox\b|\b(not|never|isn't|aren't) (written|saved)\b|\buntil\b[^.\n]*\bsaved\b|\bunless\b[^.\n]*\bsaved\b/i;
const REGISTRATIONS = /\bregistration|\bregistered\b|\boverbook|\bsign-?ups?\b/i;
/** @param {string} card */
function cardGap(card) {
  const lines = card.split('\n');
  const claim = lines
    .flatMap((l) => l.replace(/\*\*/g, '').replace(/^[-*#\s]+/, '').split(/(?<=\.)\s+/))
    .find((l) => SYNC.test(l) && !QUALIFIED.test(l));
  if (claim)
    return `\`LIMITS.md\` still says "${claim.trim()}". The run only sees what someone saved in \`summer/\`, not the venues' latest word.`;
  // The card's parts: each heading, or a line's bold lead ("**Who
  // decides.** ..."), with the lines under it. The title starts none.
  /** @type {{ heading: string, body: string }[]} */
  const parts = [];
  for (const line of lines) {
    const heading = /^#{2,6}\s+(.*)$/.exec(line);
    const lead = /^\*\*([^*]+)\*\*(.*)$/.exec(line);
    if (heading) parts.push({ heading: String(heading[1]), body: '' });
    else if (lead) parts.push({ heading: String(lead[1]), body: `${lead[2]}\n` });
    else if (/^#\s/.test(line)) continue;
    else if (parts.length) /** @type {{ body: string }} */ (parts[parts.length - 1]).body += `${line}\n`;
  }
  const cannotHeading = /\bcan(not|'t| not)\b|\bdoesn't\b|\bdoes not\b|\blimits?\b/i;
  const part = (/** @type {RegExp} */ re) => parts.find((p) => re.test(p.heading));
  const cannot = part(cannotHeading);
  const does = parts.find((p) => /\bdoes\b/i.test(p.heading) && !cannotHeading.test(p.heading));
  if (!does || !does.body.trim()) return '`LIMITS.md` doesn\'t say what the run does. Give it a part for what it does.';
  if (!cannot || !cannot.body.trim()) return '`LIMITS.md` doesn\'t say what the run can\'t do. Give it a part for what it cannot do.';
  if (!part(/\bdecides?\b|\bwho\b/i)?.body.trim()) return '`LIMITS.md` doesn\'t say who decides what gets published. Give it a part for who decides.';
  if (!part(/\bstop/i)?.body.trim()) return '`LIMITS.md` doesn\'t say how to stop the run. Give it a part for how to stop it.';
  if (!UNSAVED.test(cannot.body))
    return '`LIMITS.md` doesn\'t say the run misses a change that arrives by phone call or in someone\'s inbox until it\'s saved in `summer/`.';
  if (!REGISTRATIONS.test(cannot.body))
    return '`LIMITS.md` doesn\'t say the run can\'t know registration numbers. Overbooking after a room change is a person\'s check.';
  return null;
}

/** @type {Item} */
export const cardRight = {
  text: '`LIMITS.md` says what the run does, what it can\'t, who decides and how to stop it, names unsaved changes and registrations, and is in the shared version',
  check(repo) {
    const card = repo.read(CARD);
    if (card === null) return 'There\'s no `summer/LIMITS.md` yet. Ask Claude to draft the limits card.';
    const gap = cardGap(card);
    if (gap) return gap;
    const saved = shared(repo, CARD);
    if (saved === null)
      return '`LIMITS.md` isn\'t in the shared version yet, so Sam won\'t get it. Ask Claude to save a version teammates will get.';
    const savedGap = cardGap(saved);
    if (savedGap) return `The shared version still has the old card. ${savedGap.replace('`LIMITS.md`', 'It')} Save a version teammates will get.`;
    return true;
  },
};

// A new file directly in summer/ that names Kofi, the parking and 14 August.
const KOFI = /\bkofi\b/i;
const PARKING = /\bpark(ing)?\b|\bcar park\b/i;
const DAY = /\b14(th)? aug(ust)?\b|\baug(ust)? 14(th)?\b/i;
const PARK_LANE = /\bpark lane\b|\bleisure centre car park\b/i;

/**
 * The notes a Learner saved in summer/: new .md files there, each with its
 * name and text.
 * @param {Repo} repo
 */
function newNotes(repo) {
  /** @type {string[]} */
  let names = [];
  try {
    names = readdirSync(join(repo.dir, SUMMER), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name);
  } catch {
    return [];
  }
  return names
    .map((name) => ({ name, text: repo.read(`${SUMMER}/${name}`) ?? '', path: `${SUMMER}/${name}` }))
    .filter((n) => n.name !== 'LIMITS.md' && atStart(repo, n.path) === null);
}

/** @type {Item} */
export const noteSaved = {
  text: 'a dated note in `summer/` records Kofi\'s parking change for 14 August, and `august.md` has the Park Lane car park',
  check(repo) {
    const page = repo.read(AUGUST);
    if (page === null) return '`summer/public/august.md` is missing. Reset this step to bring it back.';
    const notes = newNotes(repo);
    const note = notes.find((n) => KOFI.test(n.text) && PARKING.test(n.text) && DAY.test(n.text));
    if (!note) {
      if (notes.some((n) => KOFI.test(n.text) || PARKING.test(n.text)))
        return 'The note in `summer/` doesn\'t mention Kofi, the car park and 14 August together. Say who told you, what changed and for which day.';
      if (PARK_LANE.test(page)) return '`august.md` has the parking line, but no file in summer/ says it. The next refresh will remove it.';
      return 'No new file in `summer/` records Kofi\'s call yet, so the run can\'t know about the car park. Save what he said there first.';
    }
    if (!PARK_LANE.test(page))
      return '`august.md` doesn\'t send people to the leisure centre car park on Park Lane yet. Rerun the refresh for August, now the change is saved in `summer/`.';
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

// Each run's report, as the runner adds them to its history.
/** @param {string} history */
const runsIn = (history) =>
  history
    .split(/\n\s*\n/)
    .filter((block) => block.trim())
    .map((block) => ({
      block: block.trim(),
      clean: /^result subtype: success$/m.test(block) && /^permission denials: 0$/m.test(block),
      changed: changedIn(block) ?? [],
    }));

const RERUN = 'Rerun the refresh for August: in `fixit/`, `summer/run/refresh.sh "Refresh august.md from its sources. Change nothing else."`.';

/** @type {Item} */
export const runMadeIt = {
  text: 'a refresh run that ended in `success` with no denials made the August change, and nothing changed `august.md` after it',
  check(repo) {
    const history = repo.read(HISTORY);
    const text = repo.read(RESULT);
    if (history === null || text === null) return `No run of the refresh has a record yet. ${RERUN}`;
    const result = parse(text);
    if (!isObject(result) || result.type !== 'result')
      return '`summer/run/last-run/result.json` isn\'t the result of a `claude -p` run. Run the refresh with the runner as it was prepared.';
    const report = repo.read(REPORT);
    if (report === null || changedIn(report) === null)
      return 'The last run has no report of the files it changed, which the runner saves beside its result. Run the refresh with the runner as it was prepared.';
    const runs = runsIn(history);
    if (
      !report.includes(`result subtype: ${String(result.subtype)}\n`) ||
      !report.includes(`estimated cost: $${String(result.total_cost_usd)} `) ||
      runs[runs.length - 1]?.block !== report.trim()
    )
      return 'The report, the result and the history in `summer/run/` don\'t describe the same last run. Run the refresh with the runner as it was prepared.';
    const used = repo.read(USED);
    if (used === null || used !== repo.read(BOUNDS))
      return 'The last run ran before `summer/run/bounds.json` last changed. Run the refresh again, so its record shows what these bounds do.';
    const page = repo.read(AUGUST);
    const page0 = atStart(repo, AUGUST);
    if (!runs.some((r) => r.clean && r.changed.includes('summer/public/august.md'))) {
      if (page !== page0)
        return 'No run that ended in `success` with no denials changed `august.md`, so the change was made by hand. The next refresh rewrites the page from `summer/`: save the change there, then rerun.';
      return `No run that ended in \`success\` with no denials has changed \`august.md\` yet. ${RERUN}`;
    }
    if (page !== repo.read(`${PAGES}/august.md`))
      return '`august.md` has changed since the last run wrote it. A change made by hand goes at the next refresh: save it in `summer/`, then rerun.';
    return true;
  },
};

/** @param {unknown} list */
const strings = (list) => (Array.isArray(list) ? list.map(String) : []);

/** @type {Item} */
export const scopesKept = {
  text: 'the personal settings file isn\'t shared, and the team\'s deny rules are as they were',
  check(repo) {
    if (repo.git('ls-files', '--', LOCAL))
      return '`.claude/settings.local.json` is in the shared version. It\'s personal: Sam\'s allow rule would go to everyone. Take it out with `git rm --cached fixit/.claude/settings.local.json` and save a version again.';
    for (const [path, rules] of [
      [SETTINGS, ['Read(./**/private/**)']],
      [BOUNDS, ['Read(**/private/**)', 'WebFetch']],
    ]) {
      const name = String(path).replace('fixit/', '');
      const now = parse(repo.read(String(path)));
      const start = parse(atStart(repo, String(path)));
      const deny = isObject(now) ? strings(now.permissions?.deny) : [];
      const allow = isObject(now) ? strings(now.permissions?.allow) : [];
      const allow0 = isObject(start) ? strings(start.permissions?.allow) : [];
      const deny0 = isObject(start) ? strings(start.permissions?.deny) : [];
      const missing = [...rules, ...deny0].find((r) => !deny.includes(r));
      if (!isObject(now) || missing)
        return `\`${name}\` no longer denies ${missing ? `\`${missing}\`` : 'what it did'}. The team's deny rules are what the card promises: put it back.`;
      const added = allow.find((r) => !allow0.includes(r));
      if (added)
        return `\`${name}\` now allows \`${added}\`, which it didn't when the lesson began. The run reads everything in \`summer/\` already: a note there needs no new access.`;
    }
    const savedSettings = parse(shared(repo, SETTINGS));
    if (!isObject(savedSettings) || !strings(savedSettings.permissions?.deny).includes('Read(./**/private/**)'))
      return 'The shared `.claude/settings.json` no longer denies reads of `private/`. Put the deny rule back and save a version again.';
    return true;
  },
};

export const items = [cardRight, noteSaved, runMadeIt, scopesKept];
