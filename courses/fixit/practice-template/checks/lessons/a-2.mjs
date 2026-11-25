// @ts-check
// Choose how to split the work (Fix-It, Advanced lesson 1). The check reads
// the three easy-read pages the Learner has Claude make beside the summer
// pages, each against its own session, and that the session pages and the
// schedule are as the Worked example left them. Which helper wrote or
// checked each page is the host's to record (handoff N7); until it is, the
// Lesson asks the Learner, and the check reads only the files. Last, it
// reads the Learner's own choice for two jobs: subagents for helpers that
// only report back, an agent team for helpers that must challenge each
// other. Questerm runs no agent team, so the choice is all it can read.
import { quote } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Choose how to split the work';

export const PUBLIC = 'fixit/summer/public';
/** Each session: its page, its date as people write it, and its venue. */
export const SESSIONS = [
  { id: 'june', day: 'Saturday 12 June', date: /\b12(?:th)?\s+June\b|\bJune\s+12(?:th)?\b/i, venue: /\bRoom\s+B\b/i, place: 'Millbrook Library, Room B', source: 'booking-june-roomB.md' },
  { id: 'july', day: 'Saturday 10 July', date: /\b10(?:th)?\s+July\b|\bJuly\s+10(?:th)?\b/i, venue: /\bRoom\s+B\b/i, place: 'Millbrook Library, Room B', source: 'booking-july-roomB.md' },
  { id: 'august', day: 'Saturday 14 August', date: /\b14(?:th)?\s+Aug(?:ust)?\b|\bAug(?:ust)?\s+14(?:th)?\b/i, venue: /\bNorthside\b/i, place: 'Northside Community Centre', source: 'northside-august-email.md' },
];
export const easyPath = (/** @type {string} */ id) => `${PUBLIC}/${id}-easy.md`;
export const pagePath = (/** @type {string} */ id) => `${PUBLIC}/${id}.md`;
export const SCHEDULE = `${PUBLIC}/schedule.md`;

/** @type {Item} */
export const easyMade = {
  text: '`june-easy.md`, `july-easy.md` and `august-easy.md` each give their own session\'s date and place',
  check(repo) {
    for (const s of SESSIONS) {
      const name = `${s.id}-easy.md`;
      const text = repo.read(easyPath(s.id));
      if (text === null) return `There's no \`${easyPath(s.id)}\` yet. Each easy-read version is saved beside its page, as \`${name}\`.`;
      if (!s.date.test(text)) return `\`${name}\` doesn't give its date, ${s.day}. Check it against \`fixit/summer/${s.source}\`.`;
      if (!s.venue.test(text)) return `\`${name}\` doesn't say where: ${s.place}. Check it against \`fixit/summer/${s.source}\`.`;
      const other = SESSIONS.find((o) => o !== s && o.date.test(text));
      if (other) return `\`${name}\` gives ${other.day.replace('Saturday ', '')}, the ${other.id} session's date. Each easy-read version comes from its own page's sources.`;
    }
    return true;
  },
};

// What a line about getting in says: the floor, the lift or stairs, steps,
// level access, or that it is being confirmed.
const ACCESS = /\b(?:lifts?|stairs?|steps?|step-free|upstairs|downstairs|first floor|ground floor|level access|level floor|wheelchairs?|ramps?|accessible|access)\b/i;

/** @type {Item} */
export const accessFirst = {
  text: 'each easy-read version puts the access line first',
  check(repo) {
    for (const s of SESSIONS) {
      const text = repo.read(easyPath(s.id));
      if (text === null) return `There's no \`${easyPath(s.id)}\` yet.`;
      // An easy-read page has one fact a line, so the first line under the
      // heading is the first thing a reader meets.
      const first = text
        .replace(/<!--[\s\S]*?-->/g, '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
        .find((line) => line && !line.startsWith('#'));
      if (first === undefined) return `\`${s.id}-easy.md\` has a heading and nothing under it.`;
      if (!ACCESS.test(first)) return `The first line of \`${s.id}-easy.md\` is "${quote(first)}". The access line comes first: how to get to the room, for someone who can't use stairs.`;
    }
    return true;
  },
};

// The battery rule the Worked example adds: one more item on a page's
// `;` list, or a line of its own under the schedule's table.
const RULE = /\b36\s?V\b/i;
const RULE_ITEM = /[;,]\s*(?:and\s+)?[^;,]*\b36\s?V\b[^;,]*/gi;
/** A page's text with the battery rule taken out, line ends, trailing stops and blank runs aside. @param {string} text */
export function withoutRule(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) => {
      if (RULE.test(line) && !line.includes(';')) return [];
      return [line.replace(RULE_ITEM, '').replace(/[\s.;,]+$/, '')];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text `path` had in the copy's first commit, or null when that commit lacks it or git can't say. @param {Repo} repo @param {string} path */
function started(repo, path) {
  try {
    const [root] = repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean);
    return root ? repo.gitLocal('show', `${root}:./${path}`) : null;
  } catch {
    return null;
  }
}

/** @type {Item} */
export const originalsKept = {
  text: 'the three session pages and the schedule are as the Worked example left them',
  check(repo) {
    for (const path of [...SESSIONS.map((s) => pagePath(s.id)), SCHEDULE]) {
      const name = path.split('/').pop();
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Reset this step to bring it back.`;
      const was = started(repo, path);
      if (was === null || withoutRule(was) !== withoutRule(text))
        return path === SCHEDULE
          ? `\`${name}\` changed. The schedule is built from the session pages, so the easy-read job leaves it as it was. Reset this step to bring it back.`
          : `\`${name}\` changed. The easy-read job leaves the original pages as they were. Reset this step to bring them back.`;
      if (!RULE.test(text))
        return `\`${name}\` doesn't have the new battery rule. The Worked example adds it in Step 3: lithium power tool batteries over 36 V.`;
    }
    return true;
  },
};

export const CHOICES = 'fixit/summer/a-2/how-to-run.md';
const NAME = 'how-to-run.md';
/** The two jobs the file asks about, and the way each needs. */
const JOBS = [
  {
    n: 1,
    way: 'subagents',
    wrong: 'Job 1 runs as an agent team, but each easy-read helper reads its own sources and only reports back: none needs another\'s findings. Agent teams use significantly more tokens than a single session, so subagents fit.',
  },
  {
    n: 2,
    way: 'agent team',
    wrong: 'Job 2 runs as subagents, but subagents report back to the main conversation. Priya\'s three helpers must challenge each other\'s case and agree one plan between them: that is what an agent team is for.',
  },
];
const LABEL = { subagents: '`subagents`', 'agent team': '`agent team`' };
const TEAM = /\bagent[\s-]+teams?\b|\bteam(?:s|mates?)?\b/i;
const SUBAGENTS = /\bsub[\s-]?agents?\b/i;
// A way the Learner turns down, such as "subagents, not an agent team",
// names the other one.
const NOT = /\b(?:not|no|never|don't|rather than|instead of|without)\s+(?:use\s+|using\s+)?(?:an?\s+|the\s+)?(?:agent[\s-]+teams?|teams?|teammates?|sub[\s-]?agents?)\b/gi;
// Words that join a way to its reason, and so are no reason of their own.
const FILLER = /\b(?:because|since|as|so|an?|the|run|it|with)\b|[^\p{L}\p{N}\s']/giu;

/** What the Learner wrote for job `n`: the text after its "Run it with:", or under its heading; null with no heading. @param {string} text @param {number} n */
export function answerFor(text, n) {
  const lines = text.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^#{1,6}\\s*Job\\s*${n}\\b`, 'i').test(line));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && /^#{1,6}\s/.test(line));
  const body = lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
  const at = body.search(/run it with\s*:?/i);
  return at === -1 ? body : body.slice(at).replace(/^run it with\s*:?/i, '');
}

/** The way an answer picks first, once the ways it turns down are gone, and the rest of the answer, its reason. @param {string} answer */
export function wayOf(answer) {
  const kept = answer.replace(/\u2019/g, "'").replace(NOT, ' ');
  const team = kept.search(TEAM);
  const sub = kept.search(SUBAGENTS);
  if (team === -1 && sub === -1) return null;
  const way = sub === -1 || (team !== -1 && team < sub) ? 'agent team' : 'subagents';
  const match = /** @type {RegExpExecArray} */ ((way === 'agent team' ? TEAM : SUBAGENTS).exec(kept));
  const reason = `${kept.slice(0, match.index)} ${kept.slice(match.index + match[0].length)}`.replace(FILLER, ' ').trim();
  return { way, reason };
}

/** @type {Item} */
export const runChoices = {
  text: '`how-to-run.md` runs the easy-read pages with subagents and July\'s fallback with an agent team, and says why',
  check(repo) {
    const text = repo.read(CHOICES);
    if (text === null) return `There's no \`${CHOICES}\`. Write it in the files tab: a heading for each job, and under each, \`subagents\` or \`agent team\` and why.`;
    for (const job of JOBS) {
      const answer = answerFor(text, job.n);
      if (answer === null) return `\`${NAME}\` has no heading for Job ${job.n}. Keep both job headings, and write your choice under each.`;
      const picked = wayOf(answer);
      if (picked === null) return `Under Job ${job.n}, \`${NAME}\` names neither way. After "Run it with:", write \`subagents\` or \`agent team\`, then "because" and your reason.`;
      if (picked.way !== job.way) return job.wrong;
      if (!/\p{L}{2,}/u.test(picked.reason)) return `Job ${job.n} says ${LABEL[picked.way]} but not why. Add "because" and your reason.`;
    }
    return true;
  },
};

// The pages first: a Learner who rewrote them in place reads that before
// the missing easy-read files it explains. The choice comes last, so the
// first three keep the numbers Y3's cards check.
export const items = [originalsKept, easyMade, accessFirst, runChoices];
