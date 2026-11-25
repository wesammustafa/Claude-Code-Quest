// @ts-check
// Release day for the summer series (Fix-It, Advanced capstone). The check
// reads the four public pages, the 14:00 email in the outbox, the go/no-go
// note, the records the refresh runner keeps of its runs and the reviewer's
// report Claude saves. The run records (`summer/run/last-run/`, the history
// `summer/run/runs.txt`) and the reviewer's report are files in the
// practice copy: the host keeps no record of its own runs or subagents yet
// (handoff N7), so a Learner could write them by hand, and the lesson says
// so. When Maya was told to hold, before noon in the Lesson's clock, is a
// self-check for the same reason.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STUB_SESSION } from '../stub-claude.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Release day for the summer series';

export const PUBLIC = 'fixit/summer/public';
export const JUNE = `${PUBLIC}/june.md`;
export const JULY = `${PUBLIC}/july.md`;
export const AUGUST = `${PUBLIC}/august.md`;
export const SCHEDULE = `${PUBLIC}/schedule.md`;
export const OUTBOX_DIR = 'fixit/summer/outbox';
export const OUTBOX = `${OUTBOX_DIR}/reminder-2027-06-11-1400.md`;
export const NOTE = 'fixit/summer/go-no-go.md';
export const BOUNDS = 'fixit/summer/run/bounds.json';
export const RUNNER = 'fixit/summer/run/refresh.sh';
export const RESULT = 'fixit/summer/run/last-run/result.json';
export const REPORT = 'fixit/summer/run/last-run/report.txt';
export const USED = 'fixit/summer/run/last-run/bounds.json';
export const HISTORY = 'fixit/summer/run/runs.txt';
export const REVIEW = 'fixit/summer/reviews/release-check.md';

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

/** A page's lines, its HTML comments left out. @param {string} text */
const linesOf = (text) =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((l) => l.trim());
/** A line as the Learner wrote it, without list or table marks. @param {string} line */
const shown = (line) => line.replace(/\*\*/g, '').replace(/^[-*]\s+/, '').trim();
/** A table row's cell that speaks of access, else the whole line. @param {string} line */
// The words of a line that make the claim: the table cell, then the
// sentence in it, with no closing full stop to clash with the quote's.
const accessOf = (line) => {
  const cell = shown(line)
    .split('|')
    .map((c) => c.trim())
    .find((c) => /step|lift/i.test(c)) ?? shown(line);
  const sentence = cell.split(/(?<=\.)\s+/).find((c) => /step|lift/i.test(c)) ?? cell;
  return sentence.replace(/\.$/, '');
};

// A line that says there is a lift, or that the room is step-free, with
// nothing on it that says otherwise: a lift out of service, not step-free,
// or a line for someone who needs step-free access.
const LIFT_OUT = /out of service|out of order|not working|isn't working|is broken|no lift|without a lift|lift is out/i;
const NOT_FREE = /\b(not|isn't|no) step[- ]free\b/i;
const ASKS = /\b(need|needs|if you|call|ask)\b/i;
/** @param {string} line */
const claims = (line) =>
  (/\blift\b/i.test(line) && !LIFT_OUT.test(line)) ||
  (/\bstep[- ]free\b/i.test(line) && !NOT_FREE.test(line) && !ASKS.test(line)) ||
  /\bno steps\b/i.test(line);

// A hold notice: the page says its details are being updated and lists no
// rules, so it publishes no fact that could be wrong.
const HOLD = /\b(being updated|to be updated|details to follow|on hold|being confirmed|to be confirmed|check back|will update this page)\b/i;
const RULES = /can't take|cannot take|can not take|not accept|can't accept/i;
/** @param {string} text */
export const isHold = (text) => HOLD.test(text) && !RULES.test(text) && !linesOf(text).some(claims);

const MOVED = /\b(moved|moving|new room|room change|change of room|changed|instead of Room B|from Room B|no longer in Room B)\b/i;
const ROOM_B = /\bRoom B\b/i;
const ROOM_A = /\bRoom A\b/i;
const JUNE_DAY = /\b12(?:th)?\s+June\b|\bJune\s+12(?:th)?\b/i;
const JULY_DAY = /\b10(?:th)?\s+July\b|\bJuly\s+10(?:th)?\b/i;

/** The number of places a page or a line gives, or null when it gives none. @param {string} text */
function placesIn(text) {
  const m = text.match(/\b(\d{1,3})\s+(?:public\s+)?(?:places|seats|spaces|tickets)\b/i);
  return m ? Number(m[1]) : null;
}

/** A schedule row's places: a table row's last cell, else the number before "places". @param {string} row */
function rowPlaces(row) {
  if (row.includes('|')) {
    const cells = row
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);
    const last = cells[cells.length - 1] ?? '';
    const m = last.match(/^\**(\d{1,3})\**$/);
    return m ? Number(m[1]) : null;
  }
  return placesIn(row);
}

/**
 * What is wrong with a June line or page's room and places, or null.
 * @param {string[]} lines
 * @param {string} name how the message names it
 */
function juneOff(lines, name) {
  const b = lines.find((l) => ROOM_B.test(l) && !MOVED.test(l));
  if (b) return `${name} still gives Room B: "${shown(b)}". The late email of 10 June, newer than the 19 May booking, moved June to Room A.`;
  if (!lines.some((l) => ROOM_A.test(l))) return `${name} doesn't say Room A. The late email of 10 June moved the June session to Room A.`;
  return null;
}

/** @param {number} n @param {string} name */
const tooMany = (n, name) =>
  `${name} offers ${n} places, more than Room A can take: it holds 30 people including your team. How many of the team will be there?`;

/** @type {Item} */
export const juneRight = {
  text: '`june.md` gives Room A and says the session moved, with no more places than Room A can take',
  check(repo) {
    const page = repo.read(JUNE);
    if (page === null) return '`summer/public/june.md` is missing. Reset this step to bring it back.';
    const lines = linesOf(page);
    const room = juneOff(lines, '`june.md`');
    if (room) return room;
    const n = placesIn(lines.join('\n'));
    if (n !== null && n > 24) return tooMany(n, '`june.md`');
    if (!lines.some((l) => MOVED.test(l)))
      return '`june.md` doesn\'t say the session has moved. Anyone who booked for Room B needs to see that June is now in Room A.';
    return true;
  },
};

/**
 * What is wrong with a July line or page's access, or null.
 * @param {string[]} lines
 * @param {string} name
 */
function julyOff(lines, name) {
  const claim = lines.find(claims);
  if (claim)
    return `${name} still says "${accessOf(claim)}". The lift is out of service until at least 20 July, so Room B isn't step-free on 10 July.`;
  if (!lines.some((l) => NOT_FREE.test(l) || LIFT_OUT.test(l) || HOLD.test(l)))
    return `${name} doesn't say whether Room B is step-free on 10 July. Someone who needs step-free access has to find that first.`;
  return null;
}

/** @type {Item} */
export const julyRight = {
  text: '`july.md` says Room B isn\'t step-free on 10 July, or holds the details back with the desk\'s number',
  check(repo) {
    const page = repo.read(JULY);
    if (page === null) return '`summer/public/july.md` is missing. Reset this step to bring it back.';
    const lines = linesOf(page);
    const off = julyOff(lines, '`july.md`');
    if (off) return off;
    if (isHold(page) && !/555-0100/.test(page))
      return '`july.md` holds the July details back, but gives no number to call. Add the events desk\'s public number, 555-0100.';
    return true;
  },
};

/** @type {Item} */
export const scheduleRight = {
  text: '`schedule.md` gives June in Room A with the June page\'s places, and doesn\'t call July step-free',
  check(repo) {
    const page = repo.read(SCHEDULE);
    if (page === null) return '`summer/public/schedule.md` is missing. Reset this step to bring it back.';
    const lines = linesOf(page);
    const june = lines.find((l) => JUNE_DAY.test(l));
    if (!june) return '`schedule.md` has no line for Saturday 12 June.';
    const room = juneOff([june], '`schedule.md`\'s June row');
    if (room) return room;
    const n = rowPlaces(june);
    if (n !== null && n > 24) return tooMany(n, '`schedule.md`\'s June row');
    const july = lines.find((l) => JULY_DAY.test(l));
    if (!july) return '`schedule.md` has no line for Saturday 10 July.';
    const off = julyOff([july], '`schedule.md`\'s July row');
    if (off) return off;
    const junePage = repo.read(JUNE);
    const pageN = junePage === null ? null : placesIn(linesOf(junePage).join('\n'));
    if (junePage !== null && pageN !== n)
      return `\`schedule.md\`'s June row gives ${n ?? 'no number of'} places, and \`june.md\` gives ${pageN ?? 'no number'}. Rebuild the schedule from the pages.`;
    return true;
  },
};

/** The Markdown pages in a folder of the copy, by their path from project/. @param {Repo} repo @param {string} dir */
function pagesIn(repo, dir) {
  try {
    return readdirSync(join(repo.dir, dir), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => `${dir}/${e.name}`)
      .sort();
  } catch {
    return [];
  }
}

const BATTERY = /\blithium\b/i;
const VOLTS = /\b36\s?-?V\b|\b36[- ]?volts?\b/i;

/** @type {Item} */
export const batteryRule = {
  text: 'every page that goes up gives the rule on lithium power tool batteries over 36 V',
  check(repo) {
    for (const path of pagesIn(repo, PUBLIC)) {
      const page = repo.read(path) ?? '';
      if (path === JULY && isHold(page)) continue;
      if (!BATTERY.test(page) || !VOLTS.test(page))
        return `\`${path.replace(`${PUBLIC}/`, '')}\` doesn't give the fire officer's rule: no lithium power tool batteries over 36 V, from June.`;
    }
    return true;
  },
};

const PUBLIC_NUMBERS = ['555-0100', '555-0130'];
/** The 555-01xx numbers a text gives, each as 555-01xx. @param {string} text */
const numbersIn = (text) => [...text.matchAll(/555[ .-]?01\d{2}/g)].map((m) => m[0].replace(/^555[ .-]?/, '555-'));

/** @type {Item} */
export const publicNumbers = {
  text: 'the pages and the email give no number but 555-0100 and 555-0130',
  check(repo) {
    for (const path of [...pagesIn(repo, PUBLIC), ...pagesIn(repo, OUTBOX_DIR)]) {
      const other = numbersIn(repo.read(path) ?? '').find((n) => !PUBLIC_NUMBERS.includes(n));
      if (other)
        return `\`${path.replace('fixit/', '')}\` gives ${other}, which isn't a public number. Only 555-0100 (Millbrook Library) and 555-0130 (Northside) go on a page or in the email.`;
    }
    return true;
  },
};

const STOPPED = /^(held|hold|on[- ]hold|cancelled|canceled|draft|paused)$/i;

/** @type {Item} */
export const outboxSafe = {
  text: 'the 14:00 email is held, cancelled or a draft, or its body is right',
  check(repo) {
    const mail = repo.read(OUTBOX);
    if (mail === null)
      return '`summer/outbox/reminder-2027-06-11-1400.md` is missing. Reset this step to bring it back, then change its status: Priya needs to see what happened to it.';
    const status = mail.match(/^status:\s*(.+?)\s*$/im)?.[1];
    if (status === undefined) return 'The outbox file has no `status:` line. Give it one: held, cancelled or draft, or scheduled with a corrected body.';
    if (STOPPED.test(status)) return true;
    if (!/^scheduled$/i.test(status))
      return `The outbox file says \`status: ${status}\`. To stop the email, use held, cancelled or draft; to send it, keep scheduled with a corrected body.`;
    const lines = linesOf(mail);
    const still = 'The 14:00 email is still `scheduled`, and';
    const goes = 'It goes to 70 people at 14:00: hold it, or correct its body.';
    const june = lines.filter((l) => JUNE_DAY.test(l));
    const july = lines.filter((l) => JULY_DAY.test(l));
    const claim = july.find(claims);
    if (claim) return `${still} its body says July is "${accessOf(claim)}". ${goes}`;
    const b = june.find((l) => ROOM_B.test(l) && !MOVED.test(l));
    if (b || (june.length && !june.some((l) => ROOM_A.test(l)))) return `${still} its June line doesn't give Room A. ${goes}`;
    const n = june.map(rowPlaces).find((x) => x !== null);
    if (n !== undefined && n > 24) return `${still} its June line offers ${n} places. ${goes}`;
    const other = numbersIn(mail).find((x) => !PUBLIC_NUMBERS.includes(x));
    if (other) return `${still} its body gives ${other}, which isn't a public number. ${goes}`;
    if (!june.length || !july.length || julyOff(july, 'its July line'))
      return `${still} its body doesn't give June's room and July's access as the pages now do. ${goes}`;
    return true;
  },
};

const DENIED = /\b(denied|denial|denials|refused|refusal|permission_denials|blocked|not allowed)\b/i;
const LATE = /late-email-2027-06-10|late email|\b10 June\b|\bDee\b/i;
const CALL = /\b(go|no[- ]go|hold|held|holding|ship|publish|post|cancel|cancelled|canceled|send|sending|don't send|do not send|wait|stop|stopped)\b/i;
const HOLDS = /\b(hold|held|holding|no[- ]go|wait|don't publish|do not publish)\b/i;
const NOT_GO = /\bno[- ]go\b|\b(?:don't|do not|not) publish\b/gi;
const GOES = /\b(go|ship|publish|post)\b/i;
const OVER = /\b(over|too many|more than|extra|waitlist|wait list|overbooked|over-booked|won't fit|don't fit|can't fit)\b/i;
const OPEN = /\b(would change|change (?:this|my|the|these|our) (?:decision|call|calls)|open question|still open|not yet (?:answered|heard)|haven't heard|have not heard|no answer|no reply|waiting (?:for|on)|asked)\b/i;
const SUBJECTS = [
  { name: '`june.md`', re: /\bjune\b/i },
  { name: '`july.md`', re: /\bjuly\b/i },
  { name: '`august.md`', re: /\baugust\b/i },
  { name: '`schedule.md`', re: /\bschedule\b/i },
  { name: 'the 14:00 email', re: /\b(e-?mail|reminder|outbox)\b/i },
];

/** @type {Item} */
export const noteDefensible = {
  text: '`go-no-go.md` makes a call on each page and the email, with the late email, the overnight denial, June\'s numbers and what would change it',
  check(repo) {
    const note = repo.read(NOTE);
    if (note === null) return 'There\'s no `summer/go-no-go.md` yet. Write the release note for Maya and Priya there.';
    const lines = linesOf(note);
    if (!lines.some((l) => /\bjuly\b/i.test(l) && DENIED.test(l)))
      return '`go-no-go.md` doesn\'t say the overnight run was refused `july.md`. The run said success: say what it was denied, and what that left wrong.';
    if (!LATE.test(note)) return '`go-no-go.md` doesn\'t cite the library\'s late email of 10 June, the evidence for June\'s room and July\'s access.';
    const calls = SUBJECTS.map((s) => ({ s, line: lines.find((l) => s.re.test(l) && CALL.test(l)) }));
    for (const { s, line } of calls)
      if (!line) return `\`go-no-go.md\` doesn't make a call on ${s.name}. Give each page and the email its own call: go, hold or no-go.`;
    if (calls.slice(0, 4).every(({ line }) => HOLDS.test(line ?? '') && !GOES.test((line ?? '').replace(NOT_GO, ''))))
      return '`go-no-go.md` holds every page. Holding isn\'t neutral: May\'s pages stay live, and they send June\'s 28 people to Room B and tell July\'s readers the lift works.';
    const numbers = /\b28\b/.test(note) && (/\b24\b/.test(note) || OVER.test(note));
    if (!numbers && !/\b(waitlist|wait list|overbooked|over-booked)\b/i.test(note))
      return '`go-no-go.md` doesn\'t say what happens to June\'s 28 registrations, now that Room A takes fewer people. Who tells the extra bookings, and when?';
    if (!OPEN.test(note)) return '`go-no-go.md` doesn\'t say what you asked and haven\'t heard back, or what would change your calls.';
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

// Each run's report, as the runner adds them to its history, with whether
// the run ended in success with no denials, and the files it changed.
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

/** @param {unknown} list */
const strings = (list) => (Array.isArray(list) ? list.map(String) : []);
const PAGE_EDIT = /^Edit\((?:\.\/)?summer\/public\/[^/)]+\)$/;

/** What makes `text`, the bounds, wider than a fix needs, or null. @param {string} text */
function boundsOff(text) {
  /** @type {unknown} */
  let b;
  try {
    b = JSON.parse(text);
  } catch {
    b = null;
  }
  if (!isObject(b)) return '`summer/run/bounds.json` isn\'t valid JSON, so the runner\'s bounds can\'t be read. Reset this step to bring it back.';
  const allow = strings(b.permissions?.allow);
  const deny = strings(b.permissions?.deny);
  const keep = 'Keep every deny rule: Reset this step puts the file back.';
  if (/bypassPermissions|dangerously/i.test(text)) return '`summer/run/bounds.json` turns on bypassPermissions, which skips every rule. With nobody watching at 02:00, nothing would refuse a call.';
  if (!deny.some((r) => /^Read\(.*private/.test(r))) return `\`summer/run/bounds.json\` no longer denies reading \`private/\` folders. ${keep}`;
  if (!deny.some((r) => /^Edit\(.*sources/.test(r))) return `\`summer/run/bounds.json\` no longer denies editing \`sources/\`. ${keep}`;
  if (!deny.some((r) => /git push/.test(r))) return `\`summer/run/bounds.json\` no longer denies \`git push\`. ${keep}`;
  if (allow.some((r) => /^Bash(\(\*+\))?$/.test(r))) return '`summer/run/bounds.json` allows every shell command. The refresh needs no commands: take that rule out.';
  const priv = allow.find((r) => /private/.test(r));
  if (priv) return `\`summer/run/bounds.json\` allows \`${priv}\`. The run never needs a \`private/\` folder: take that rule out.`;
  const wide = allow.find((r) => /^(Edit|Write)\b/.test(r) && !PAGE_EDIT.test(r));
  if (wide) return `\`summer/run/bounds.json\` allows \`${wide}\`, beyond the pages in \`summer/public/\`. Change the bounds as little as the fix needs.`;
  return null;
}

const HAND =
  'No bounded run wrote `july.md` after the overnight one. A hand edit fixes today\'s page, not the run: did you also fix the bounds, and rerun what failed?';

/** @type {Item} */
export const rerunRecorded = {
  text: 'a refresh under the bounds as they are now ended in `success` with no denials, and runs like it wrote `july.md` and `schedule.md`; the bounds keep every deny',
  check(repo) {
    const runner = repo.read(RUNNER);
    if (runner === null || runner !== atStart(repo, RUNNER))
      return '`summer/run/refresh.sh` isn\'t as it was prepared. The rerun goes through the prepared runner, so its checks on the bounds still hold. Reset this step to bring it back.';
    const bounds = repo.read(BOUNDS);
    if (bounds === null) return '`summer/run/bounds.json` is missing, and the runner refuses to start without it. Reset this step to bring it back.';
    const wider = boundsOff(bounds);
    if (wider) return wider;
    const july = repo.read(JULY);
    const julyChanged = july !== null && july !== atStart(repo, JULY);
    const text = repo.read(RESULT);
    if (text === null) return julyChanged ? HAND : 'No refresh has run since the overnight one. Fix what made it fail, then rerun what failed with `fixit/summer/run/refresh.sh`.';
    /** @type {unknown} */
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = null;
    }
    if (!isObject(result) || result.type !== 'result')
      return '`summer/run/last-run/result.json` isn\'t the result of a `claude -p` run. Rerun with the prepared runner, `fixit/summer/run/refresh.sh`.';
    if (result.session_id === STUB_SESSION) return '`summer/run/last-run/result.json` holds the check\'s stand-in reply. Run the refresh again.';
    const report = repo.read(REPORT);
    const history = repo.read(HISTORY);
    if (report === null || changedIn(report) === null || history === null)
      return 'The run has no report of the files it changed, which the runner saves beside its result and adds to `summer/run/runs.txt`. Rerun with the runner as it was prepared.';
    const runs = runsIn(history);
    if (
      !report.includes(`result subtype: ${String(result.subtype)}\n`) ||
      !report.includes(`estimated cost: $${String(result.total_cost_usd)} `) ||
      runs[runs.length - 1]?.block !== report.trim()
    )
      return 'The report, the result and the history in `summer/run/` don\'t describe the same last run. Rerun with the runner as it was prepared.';
    if (result.subtype !== 'success' || result.is_error === true)
      return `The last refresh ended with \`${String(result.subtype)}\`, not \`success\`, so it didn't finish. Read its report in \`summer/run/last-run/\`.`;
    const denials = Array.isArray(result.permission_denials) ? result.permission_denials : [];
    if (denials.length > 0)
      return `The last refresh was refused ${denials.length === 1 ? 'a call' : `${denials.length} calls`}, so it didn't do everything it was asked. Which rule in \`summer/run/bounds.json\` refuses it?`;
    const used = repo.read(USED);
    if (used === null) return 'The run record has no copy of the bounds it ran with, which the runner saves beside it. Rerun with the runner as it was prepared.';
    if (used !== bounds)
      return 'The last refresh ran before `summer/run/bounds.json` last changed. Run it again, so its record shows what these bounds do.';
    const fixed = new Set(runs.filter((r) => r.clean).flatMap((r) => r.changed));
    if (julyChanged && !fixed.has('summer/public/july.md')) return HAND;
    for (const page of ['july.md', 'schedule.md'])
      if (!fixed.has(`summer/public/${page}`))
        return `No run that ended in \`success\` with no denials changed \`${page}\`, which the overnight run left wrong. Rerun what it left wrong.`;
    return true;
  },
};

const READ_LINE = /^\W*Read\b\W*:?\W*(.*)$/im;

/** @type {Item} */
export const reviewerRan = {
  text: 'a read-only reviewer\'s report lists what it read, the four public pages among them',
  check(repo) {
    const review = repo.read(REVIEW);
    if (review === null)
      return 'There\'s no reviewer\'s report in `summer/reviews/release-check.md`. Have a read-only reviewer check the corrected pages and the outbox, list what it read, and save its report there.';
    const read = review.match(READ_LINE)?.[1];
    if (!read) return '`release-check.md` doesn\'t say what the reviewer read. Without its Read line, you can\'t tell what its verdict covers.';
    for (const page of ['june.md', 'july.md', 'august.md', 'schedule.md'])
      if (!new RegExp(`\\b${page.replace('.', '\\.')}\\b`).test(read))
        return `The reviewer didn't read \`${page}\`, so its verdict doesn't cover it. Every page that goes up at noon needs that check.`;
    return true;
  },
};

export const items = [juneRight, julyRight, scheduleRight, batteryRule, publicNumbers, outboxSafe, noteDefensible, rerunRecorded, reviewerRan];
