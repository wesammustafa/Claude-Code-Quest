// @ts-check
// Choose how to split the work (Fix-It, Advanced lesson 1). The check reads
// the three easy-read pages the Learner has Claude make beside the summer
// pages, each against its own session, and that the session pages and the
// schedule are as the Worked example left them. Which helper wrote or
// checked each page is the host's to record (handoff N7); until it is, the
// Lesson asks the Learner, and the check reads only the files.
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

// The pages first: a Learner who rewrote them in place reads that before
// the missing easy-read files it explains.
export const items = [originalsKept, easyMade, accessFirst];
