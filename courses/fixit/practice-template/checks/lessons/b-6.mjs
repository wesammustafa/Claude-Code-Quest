// @ts-check
// Check every claim before anyone relies on it (Fix-It pilot, Beginner
// lesson 2). The check reads the fact table the Learner makes and the
// February attendee guide they correct, one claim at a time, by what each
// claim says rather than its exact words, and that the sources are as they
// arrived.
import { claims, quote, untouched } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Check every claim before anyone relies on it';

export const DRAFT = 'fixit/feb/draft-attendee-guide.md';
export const TABLE = 'fixit/feb/fact-table.md';
const EMAIL = 'fixit/feb/venue-email-feb.md';
const NOTES = 'fixit/feb/meeting-notes-2027-01-28.md';
const GROUP = 'fixit/sources/group-notes.md';
export const SOURCES = [EMAIL, NOTES, 'fixit/feb/partner-email.md', GROUP, 'fixit/sources/flyer-2026-10.md'];

// One part of a sentence at a time, as b-1 reads Jordan's note.
const PART = /[;:!?()]|\.(?=\s|$)|,|\b(?:but|so|instead|while|whereas|unless)\b/i;
const NEGATED = /\b(?:not|isn['’]t|aren['’]t|no|never|don['’]t|do not|doesn['’]t|does not|can['’]t|cannot|won['’]t|closed|shut|unavailable)\b/i;
const parts = (/** @type {string} */ claim) => claim.split(PART);
/** A part of a claim that says `re` and doesn't turn it down. @param {string} claim @param {RegExp} re */
const asserts = (claim, re) => parts(claim).some((p) => re.test(p) && !NEGATED.test(p));

/** @param {Repo} repo */
function readDraft(repo) {
  const text = repo.read(DRAFT);
  if (text === null) return { error: `\`${DRAFT}\` is missing. Reset this step to bring it back.` };
  return { text, lines: claims(text) };
}

/** @type {Item} */
export const sourcesKept = {
  text: 'the sources are as they arrived',
  check(repo) {
    for (const path of SOURCES) {
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Sources stay as they arrived: reset this step to bring it back.`;
      if (!untouched(repo, path, text)) return `\`${path}\` has changed. Sources stay as they arrived, so the next check can read them: undo the change, or reset this step.`;
    }
    return true;
  },
};

// A table row: a line that starts and ends with |, not the header's rule.
const ROW = /^\s*\|.*\|\s*$/;
const RULE = /^\s*\|[\s:|-]+\|\s*$/;
const NAMES_SOURCE = /\b(?:venue-email|meeting-notes|group-notes|flyer|partner-email|booking)[\w-]*(?:\.md)?|\.md\b/i;
const BISCUITS = /\bbiscuits?\b/i;
const AGREES = /\b(?:agrees?|right|correct|true|supported|confirmed|ok|yes)\b/i;
const NOT_AGREES = /\b(?:partly|partially|not|wrong|half|but|except|only|unsupported|contradict\w*)\b/i;

/** @type {Item} */
export const tableMade = {
  text: '`fixit/feb/fact-table.md` gives each claim a verdict and the line that settles it',
  check(repo) {
    const text = repo.read(TABLE);
    if (text === null) return `There's no \`${TABLE}\` yet. Make one: each claim in the draft, its verdict, and the file and line that settles it.`;
    const rows = text.split(/\r?\n/).filter((l) => ROW.test(l) && !RULE.test(l));
    const body = rows.slice(1);
    if (body.length < 8) return `The fact table has ${body.length} claim row${body.length === 1 ? '' : 's'}. The draft makes at least eight claims: give each one a row.`;
    const unsourced = body.find((r) => !NAMES_SOURCE.test(r));
    if (unsourced) return `This row names no file: "${quote(unsourced.replace(/\|/g, ' ').trim())}". Add the file and line that settles it, so someone else can check it.`;
    const biscuits = body.find((r) => BISCUITS.test(r));
    if (biscuits) {
      const [, , verdict = ''] = biscuits.split('|');
      if (AGREES.test(verdict) && !NOT_AGREES.test(verdict)) return `The fact table says "${quote(biscuits.split('|')[1]?.trim() ?? 'Tea and biscuits')}" ${verdict.trim().toLowerCase()}. Read every line of \`${NOTES}\` about February before you accept that row.`;
    }
    return true;
  },
};

export const START_10 = /(?<![\w:.])(?:10(?::00)?\s*(?:am|a\.m\.)|10:00|ten o['’]?clock)(?![\w:])/i;
export const START_1030 = /\b10[:.]30(?!\d)|\bhalf past ten\b/i;

// What a guide says, read claim by claim: true, or the hint. b-5 reads its
// attendee guide with these too.
/** @param {string} text */
export function startSaid(text) {
  const lines = claims(text);
  const early = lines.find((c) => START_10.test(c));
  if (early) return `The guide still says "${quote(early)}". Line 5 of \`${NOTES}\` says the public comes in from 10:30: the room is booked from 10:00 so the volunteers can set up.`;
  if (!lines.some((c) => START_1030.test(c))) return `No line says when the public can come in. Line 5 of \`${NOTES}\` says: write that time into the guide.`;
  return true;
}

/** @type {Item} */
export const timeRight = {
  text: 'the guide gives 10:30 as the public start',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    return startSaid(d.text);
  },
};

const PARKING = /\bpark(?:s|ed|ing)?\b|\bcar ?parks?\b/i;
const LIBRARY_PARK = /\blibrary(?:['’]s)?\s+car ?park\b|\bbehind the (?:library|building)\b|\bon[- ]site\b|\bat the library\b/i;
const FREE = /(?<!\bfeel\s)\bfree\b(?!\s+to\b)/i;
const STATION_ROAD = /\bstation\s+r(?:oa)?d\b/i;

/** @type {Item} */
export const parkingRight = {
  text: 'no line offers parking the library hasn\'t',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    const parking = d.lines.filter((c) => PARKING.test(c));
    const onSite = parking.find((c) => asserts(c, LIBRARY_PARK));
    if (onSite) return `The guide still offers parking at the library: "${quote(onSite)}". Line 12 of \`${EMAIL}\` says the library's car park is closed on Saturdays.`;
    const free = parking.find((c) => parts(c).some((p) => PARKING.test(p) && FREE.test(p) && !/\b(?:not|isn['’]t)\s+free\b/i.test(p)));
    if (free) return `The guide says parking is free: "${quote(free)}". Line 12 of \`${EMAIL}\` names Station Road car park but says nothing about what it costs.`;
    const vague = parking.find((c) => !STATION_ROAD.test(c) && !/\bclosed|shut\b/i.test(c));
    if (vague) return `This parking line doesn't say where to go: "${quote(vague)}". Line 12 of \`${EMAIL}\` names the nearest car park. Name it, or leave parking out.`;
    return true;
  },
};

const OVERCLAIM = /\b(?:fully\s+(?:wheelchair\s+)?accessible|wheelchair[- ]accessible|step[- ]free|accessible (?:to|for) (?:all|everyone)|level access)\b/i;

/** @type {Item} */
export const accessRight = {
  text: 'the guide claims no access the library hasn\'t confirmed',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    const over = d.lines.find((c) => asserts(c, OVERCLAIM));
    if (over) return `The guide says "${quote(over)}". Line 11 of \`${EMAIL}\` says Room B is on the first floor, with a lift: say that, or point people to the events desk, but not more than the library says.`;
    return true;
  },
};

const TURN_UP = /\bjust turn up\b|\bplenty of (?:space|room|places)\b|\bno need to book\b|\bno booking\b|\bdrop in any ?time\b/i;
const BOOK = /\bbook(?:s|ed|ing)?\b|\bevents page\b|\bsign[- ]?ups?\b|\bregister\b/i;

/** @param {string} text */
export function bookingSaid(text) {
  const lines = claims(text);
  const open = lines.find((c) => TURN_UP.test(c));
  if (open) return `The guide still says "${quote(open)}". Line 7 of \`${NOTES}\` caps sign-ups at 32, and line 18 of \`${GROUP}\` says the public books on the library's events page.`;
  if (!lines.some((c) => BOOK.test(c))) return `No line tells people to book. Line 18 of \`${GROUP}\` says how the public books: add it.`;
  return true;
}

/** @type {Item} */
export const bookingRight = {
  text: 'the guide tells people to book',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    return bookingSaid(d.text);
  },
};

const ANYTHING = /\bfix (?:anything|everything)\b|\bbring anything\b/i;

/** @type {Item} */
export const rulesRight = {
  text: 'the guide names what you can\'t bring',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    const all = d.lines.find((c) => ANYTHING.test(c));
    if (all) return `The guide still says "${quote(all)}". Lines 11 to 15 of \`${GROUP}\` list what the group doesn't accept.`;
    const text = d.lines.join('\n');
    if (!/\bmicrowaves?\b/i.test(text) || !/\bgas\b/i.test(text)) return `The guide doesn't say what you can't bring. Lines 11 to 15 of \`${GROUP}\` list it: at least microwaves and gas appliances.`;
    return true;
  },
};

const PHONE = /\b555[- .]?01\d\d\b/g;

/** @param {string} text */
export function numberSaid(text) {
  const other = [...text.matchAll(PHONE)].map((m) => m[0]).find((n) => n.replace(/\D/g, '') !== '5550100');
  if (other) return `The guide gives ${other}. Line 23 of \`${GROUP}\` says Priya's number never goes on anything public; line 22 gives the public number.`;
  return true;
}

/** @type {Item} */
export const privacyRight = {
  text: 'the only phone number is the library\'s public one',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    return numberSaid(d.text);
  },
};

const MAYBE = /\bif (?:someone|anyone|somebody) brings\b|\bnot promised\b|\bcan['’]t promise\b|\bno biscuits\b|\bmaybe\b|\bperhaps\b|\bif we have\b|\bbring your own\b/i;

/** @type {Item} */
export const biscuitsRight = {
  text: 'the guide doesn\'t promise biscuits',
  check(repo) {
    const d = readDraft(repo);
    if (d.error !== undefined) return d.error;
    const promise = d.lines.find((c) => BISCUITS.test(c) && !MAYBE.test(c));
    if (promise) return `The guide says "${quote(promise)}". Read line 12 of \`${NOTES}\`.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [sourcesKept, tableMade, timeRight, parkingRight, accessRight, bookingRight, rulesRight, privacyRight, biscuitsRight];
