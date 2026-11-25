// @ts-check
// Give Claude a clear job (Fix-It, Beginner lesson 2). The check reads what
// the Learner's briefs produced: the reminder for February's volunteers, by
// what it says rather than its exact words, and the door sign from the
// planned job; and that no source changed, which a plan the Learner should
// have sent back would have done.
import { claims, quote, untouched } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Give Claude a clear job';

export const REMINDER = 'fixit/feb/volunteer-reminder.md';
export const SIGN = 'fixit/feb/door-sign.md';
const EMAIL = 'fixit/feb/venue-email-feb.md';
const NOTES = 'fixit/feb/meeting-notes-2027-01-28.md';
const GROUP = 'fixit/sources/group-notes.md';
export const SOURCES = [GROUP, 'fixit/sources/flyer-2026-10.md', EMAIL, NOTES];

// One part of a sentence at a time, so "the room is ours from 10:00; public
// from 10:30" keeps the volunteers' time apart from the public's. A colon is
// no break: "Doors: 10am" is one claim.
const PART = /[;!?()]|\.(?=\s|$)|,|\b(?:but|while|whereas|instead|before|then)\b/i;
const parts = (/** @type {string} */ text) => claims(text).flatMap((claim) => claim.split(PART));

const AT_930 = /(?<![\d:.])(?:9[:.]30|half past nine)(?![\d:])/i;
const AT_10 = /(?<![\d:.])(?:10(?:[:.]00)?\s*(?:am|a\.m\.)|10[:.]00|ten o['’]?clock)(?![\w:])/i;
const AT_1030 = /(?<![\d:.])10[:.]30(?!\d)|\bhalf past ten\b/i;
// Who a time is for: the public coming in, or the volunteers getting in.
const PUBLIC = /\b(?:public|doors?|visitors?|everyone|attendees|open(?:s|ing)? to)\b/i;
const VOLUNTEERS = /\b(?:volunteers?|helpers?|fixers?|team|us|we|arriv\w*|get in|come in|set(?:ting)?[- ]?up|room|ours|library opens)\b/i;

/** A part that gives 10am as when the public comes in. @param {string} part */
const publicAt10 = (part) => AT_10.test(part) && PUBLIC.test(part);

const PARKING = /\bpark(?:s|ed|ing)?\b|\bcar ?parks?\b/i;
const STATION_ROAD = /\bstation\s+r(?:oa)?d\b/i;
// The library's own car park as somewhere to park, and a part of a sentence
// that turns it away, as b-1's check reads Jordan's note.
const LIBRARY_PARK = /\blibrary(?:['’]s)?\s+car ?park\b|\bbehind the (?:library|building)\b|\bon[- ]site\b|\bat the library\b|\bour car ?park\b/i;
const NOT_THERE = /\b(?:closed|shut|unavailable|can['’]t|cannot|don['’]t|doesn['’]t|avoid|never|not|no|instead of|rather than|isn['’]t)\b/i;

/** @param {Repo} repo */
function readReminder(repo) {
  const text = repo.read(REMINDER);
  if (text === null) return { error: `There's no \`${REMINDER}\` yet. Brief Claude for it: who it's for, which files to use, and what it must say.` };
  return { text, parts: parts(text) };
}

/** @type {Item} */
export const reminderRight = {
  text: '`fixit/feb/volunteer-reminder.md` tells volunteers when to get in and where to park',
  check(repo) {
    const reminder = readReminder(repo);
    if (reminder.error !== undefined) return reminder.error;
    const { parts } = reminder;
    const early = parts.find(publicAt10);
    if (early) return `The reminder gives 10am as the public start: "${quote(early)}". Line 5 of \`${NOTES}\` says the public comes in from 10:30. That 10am is last October's flyer: say which files win in your brief.`;
    const arrival = parts.some((p) => AT_930.test(p) || (AT_10.test(p) && VOLUNTEERS.test(p)));
    if (!arrival) return `The reminder doesn't say when volunteers can get in. Lines 9 and 10 of \`${EMAIL}\` say the library opens at 9:30 and the room is yours from 10:00.`;
    const parking = parts.filter((p) => PARKING.test(p));
    const stale = parking.find((p) => LIBRARY_PARK.test(p) && !NOT_THERE.test(p));
    if (stale) return `The reminder sends volunteers to the library's car park: "${quote(stale)}". Line 12 of \`${EMAIL}\` says it's closed on Saturdays for the farmers' market.`;
    const closed = parking.some((p) => LIBRARY_PARK.test(p) && NOT_THERE.test(p));
    if (!parking.some((p) => STATION_ROAD.test(p)) && !closed) return `The reminder doesn't say where to park. Line 12 of \`${EMAIL}\` says the library's car park is closed on Saturdays and names Station Road car park instead.`;
    return true;
  },
};

// A phone number: seven or more digits, with spaces, dots or hyphens
// between them. Times and dates never hold seven digits in a row.
const PHONE = /(?<![\d:])\+?\d(?:[\s.-]?\d){6,}(?![\d:])/g;
// The two numbers a volunteers' reminder may carry: Priya's, which exists
// for volunteers, and the library's public one.
const ALLOWED = new Set(['5550187', '5550100']);

/** @type {Item} */
export const numbersAllowed = {
  text: "the reminder gives no phone number but Priya's or the library's",
  check(repo) {
    const reminder = readReminder(repo);
    if (reminder.error !== undefined) return reminder.error;
    const other = [...reminder.text.replace(/<!--[\s\S]*?-->/g, ' ').matchAll(PHONE)].map((m) => m[0]).find((n) => !ALLOWED.has(n.replace(/\D/g, '')));
    if (other) return `The reminder gives ${other.trim()}. The only numbers it may carry are Priya's 555-0187, which is for volunteers, and the library's public 555-0100.`;
    return true;
  },
};

/** @type {Item} */
export const sourcesKept = {
  text: 'the sources are as they were when the lesson started',
  check(repo) {
    for (const path of SOURCES) {
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Sources stay as they are: reset this step to bring it back.`;
      if (!untouched(repo, path, text)) return `\`${path}\` has changed. Sources stay as they are, so next month's work can trust them: ask Claude to put it back as it was, or reset this step.`;
    }
    return true;
  },
};

/** @type {Item} */
export const signRight = {
  text: '`fixit/feb/door-sign.md` gives 10:30 as the start, not 10am',
  check(repo) {
    const text = repo.read(SIGN);
    if (text === null) return `There's no \`${SIGN}\` yet. Step 4's plan makes it: send its request in plan mode and approve the plan.`;
    const signParts = parts(text);
    const early = signParts.find((p) => AT_10.test(p) && !/\b(?:volunteers?|helpers?|set(?:ting)?[- ]?up)\b/i.test(p));
    if (early) return `The door sign says "${quote(early)}". The public comes in from 10:30 (line 5 of \`${NOTES}\`), so the sign gives 10:30.`;
    if (!signParts.some((p) => AT_1030.test(p))) return `The door sign doesn't give the start time. Line 5 of \`${NOTES}\` says the public comes in from 10:30: put it on the sign.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [reminderRight, numbersAllowed, sourcesKept, signRight];
