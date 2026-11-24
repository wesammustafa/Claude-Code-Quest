// @ts-check
// The Beginner capstone of the Fix-It pilot: the March attendee guide Maya
// asked for, and the readiness note that shows why it's right. The check
// reads each claim by what it says, not its exact words, and quotes the line
// it judged.
import { claims, quote, untouched } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'The March attendee guide, ready to hand over';

export const GUIDE = 'fixit/march/attendee-guide.md';
export const NOTE = 'fixit/march/readiness-note.md';
const BOOKING = 'fixit/march/booking-confirmation-march.pdf';
const BOOKING_TEXT = 'fixit/march/booking-confirmation-march-text.md';
const NOTES = 'fixit/march/meeting-notes-2027-02-20.md';
const BRIEF = 'fixit/march/BRIEF.md';
const GROUP = 'fixit/sources/group-notes.md';
export const SOURCES = [
  BRIEF,
  BOOKING,
  BOOKING_TEXT,
  NOTES,
  'fixit/march/priya-message.md',
  GROUP,
  'fixit/sources/flyer-2026-10.md',
  'fixit/sources/flyer-2026-10.png',
];

// One part of a sentence at a time, as b-1 and b-6 read their documents.
const PART = /[;:!?()]|\.(?=\s|$)|,|\b(?:but|so|instead|while|whereas|unless)\b/i;
const parts = (/** @type {string} */ claim) => claim.split(PART);

/** @param {Repo} repo */
function readGuide(repo) {
  const text = repo.read(GUIDE);
  if (text === null)
    return { error: `There's no \`${GUIDE}\` yet. Ask Claude for a draft, or write one yourself.` };
  // One line at a time: a guide is short lines, often a label and its fact.
  const lines = claims(text).flatMap((c) => c.split(/\s+(?=\*\*[^*]+:\*\*)/)).filter(Boolean);
  return { text, lines };
}

/** @type {Item} */
export const sourcesKept = {
  text: 'the sources are as they arrived',
  check(repo) {
    for (const path of SOURCES) {
      const text = repo.read(path);
      if (text === null) return `\`${path}\` is missing. Sources stay as they arrived: reset this step to bring it back.`;
      if (!untouched(repo, path, text)) return `\`${path}\` has changed. Sources stay as they arrived, so Maya can check them: undo the change, or reset this step.`;
    }
    return true;
  },
};

const MARCH_13 = /\b13(?:th)?\s+march\b|\bmarch\s+13(?:th)?\b|\b13[/.]0?3(?:[/.](?:20)?27)?\b/i;

/** @type {Item} */
export const dateRight = {
  text: 'the guide gives the date, Saturday 13 March',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (!MARCH_13.test(g.text)) return `The guide doesn't say which day. The booking's Date line gives it: \`${BOOKING_TEXT}\` line 10, or page 1 of the PDF.`;
    return true;
  },
};

const START_10 = /(?<![\w:.])(?:10(?::00)?\s*(?:am|a\.m\.)|10:00|ten o['’]?clock)(?![\w:])/i;
const START_1030 = /\b10[:.]30(?!\d)|\bhalf past ten\b/i;
const END_1 = /\b1(?::00)?\s*(?:pm|p\.m\.)|\b13:00\b|\bone o['’]?clock\b|\b1pm\b/i;

/** @type {Item} */
export const timesRight = {
  text: 'the guide gives 10:30 to 1pm',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const early = g.lines.find((c) => START_10.test(c));
    if (early) return `The guide says "${quote(early)}". The booking admits the public from 10:30 (\`${BOOKING_TEXT}\` line 12), and line 7 of \`${NOTES}\` says what happened in February to people who came at 10.`;
    if (!START_1030.test(g.text)) return `The guide doesn't say when the public can come in. The booking's Public admission line gives it (\`${BOOKING_TEXT}\` line 12).`;
    if (!END_1.test(g.text)) return 'The guide doesn\'t say when the session ends. Every source that gives an end time says 1pm.';
    return true;
  },
};

const SIXTY = /\b60\b|\bsixty\b/i;
const FORTY = /\b40\b|\bforty\b/i;
// 40 is fine where the same part says whose limit it is: the room's, with
// the volunteers in it.
const FORTY_EXPLAINED = /\b(?:volunteers?|organisers?|staff|room holds|room's limit|room is licensed)\b/i;
const NUMBER_OF_PLACES = /\b(\d+)\s+(?:places?|seats?|spaces?|spots?|sign-?ups?|tickets?|visitors?|people)\b|\b(?:places?|seats?|spaces?|sign-?ups?)\b[^.\d]{0,20}\b(\d+)\b/gi;
const TURN_UP = /\bjust turn up\b|\bno need to book\b|\bno booking\b|\bdrop in any ?time\b|\bplenty of (?:space|room|places)\b/i;
const BOOK = /\bbook(?:s|ed|ing)?\b|\bevents page\b|\bsign[- ]?up\b|\bregister\b/i;

/** @type {Item} */
export const capacityRight = {
  text: 'the guide offers no more places than the meeting agreed, and asks people to book',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const sixty = g.lines.find((c) => SIXTY.test(c));
    if (sixty) return `The guide says "${quote(sixty)}". That's the October flyer's number, and the flyer isn't about March.`;
    const forty = g.lines.find((c) => parts(c).some((p) => FORTY.test(p) && !FORTY_EXPLAINED.test(p)));
    if (forty) return `The guide says "${quote(forty)}". Read the booking's occupancy line to the end of the sentence (\`${BOOKING_TEXT}\` line 14), then line 11 of \`${NOTES}\`.`;
    for (const c of g.lines) {
      for (const m of c.matchAll(NUMBER_OF_PLACES)) {
        const n = Number(m[1] ?? m[2]);
        if (n > 30 && n !== 40) return `The guide says "${quote(c)}". Line 11 of \`${NOTES}\` caps March sign-ups at 30.`;
      }
    }
    const open = g.lines.find((c) => TURN_UP.test(c));
    if (open) return `The guide says "${quote(open)}". Line 18 of \`${GROUP}\` says the public books on the library's events page.`;
    if (!BOOK.test(g.text)) return `No line tells people to book. Line 18 of \`${GROUP}\` says how the public books: add it.`;
    return true;
  },
};

const ACCESS = /\baccess(?:ible|ibility)?\b|\blift\b|\bstep[- ]free\b|\bwheelchair\b|\bstairs?\b|\bupstairs\b|\belevator\b/i;
const ASSERTS_ACCESS = /\bstep[- ]free\b|\bwheelchair[- ]accessible\b|\bfully accessible\b|\baccessible by lift\b|\blevel access\b|\bthere(?:['’]s| is) a (?:working )?lift\b|\blift is working\b/i;
const QUALIFIED = /\b(?:being confirmed|not (?:yet )?confirmed|unconfirmed|to be confirmed|tbc|still confirming|confirming|check|call|ring|phone|ask|may not|might not|out of (?:service|order)|had repairs|repairs?)\b/i;

/** @type {Item} */
export const accessRight = {
  text: 'the guide answers how to reach Room B, without promising step-free access',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (!g.lines.some((c) => ACCESS.test(c))) return 'The guide doesn\'t say how to get to Room B. Maya\'s brief says it\'s the question people ask most (line 13 of `fixit/march/BRIEF.md`).';
    // A claim that says step-free, or accessible by lift, with nothing in the
    // same sentence that leaves it open.
    const sentences = g.lines.flatMap((c) => c.split(/(?<=[.!?])\s+/));
    const firm = sentences.find((s) => !/\?\s*$/.test(s) && ASSERTS_ACCESS.test(s) && !QUALIFIED.test(s) && !/\bnot\b|\bisn['’]t\b|\bcan['’]t\b/i.test(s));
    if (firm) return `The guide says "${quote(firm)}". Line 12 of \`${NOTES}\` says what has to happen before anyone tells the public it's step-free.`;
    return true;
  },
};

/** @type {Item} */
export const rulesRight = {
  text: 'the guide names what you can\'t bring, this month\'s new rule included',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const all = g.lines.find((c) => /\bfix (?:anything|everything)\b|\bbring anything\b/i.test(c));
    if (all) return `The guide says "${quote(all)}". Lines 11 to 15 of \`${GROUP}\` list what the group doesn't accept.`;
    const t = g.text;
    const missing = [
      [/\bmicrowaves?\b/i, 'microwaves'],
      [/\bgas\b/i, 'gas appliances'],
      [/\b(?:swollen|cracked|damaged)\b[^.\n]{0,30}\bbatter(?:y|ies)\b|\bbatter(?:y|ies)\b[^.\n]{0,30}\b(?:swollen|cracked|damaged)\b/i, 'swollen or cracked batteries'],
    ].filter(([re]) => !/** @type {RegExp} */ (re).test(t)).map(([, name]) => name);
    if (missing.length > 0) return `The guide doesn't say it can't take ${missing.join(', ')}. Lines 11 to 15 of \`${GROUP}\` list them.`;
    if (!/\be-?\s?bikes?\b|\be-?\s?scooters?\b/i.test(t)) return `The guide misses a rule that's new this month. Read every line of \`${NOTES}\` about March.`;
    return true;
  },
};

const PHONE = /\b555[- .]?01\d\d\b/g;
const LIBRARY = '5550100';

/** @type {Item} */
export const privacyRight = {
  text: 'no personal number is on the guide',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    const other = [...g.text.matchAll(PHONE)].map((m) => m[0]).find((n) => n.replace(/\D/g, '') !== LIBRARY);
    if (other) return `The guide gives ${other}. Maya's brief asks for no personal numbers (line 16 of \`${BRIEF}\`), and line 23 of \`${GROUP}\` says Priya's number never goes on anything public.`;
    return true;
  },
};

/** @type {Item} */
export const contactRight = {
  text: 'the guide gives the library\'s public number',
  check(repo) {
    const g = readGuide(repo);
    if (g.error !== undefined) return g.error;
    if (![...g.text.matchAll(PHONE)].some((m) => m[0].replace(/\D/g, '') === LIBRARY)) return `The guide gives no number to call. Line 16 of \`${BRIEF}\` names the one the front desk answers.`;
    return true;
  },
};

const NAMES_SOURCE = /\bbooking\b|\bmeeting[- ]notes\b|\bnotes\b|\bgroup[- ]notes\b|\bBRIEF\b|\bbrief\b/i;
const FLYER_FIRST = /\bflyer\b[^.\n]*\b(?:wins?|over|above|before|first|trust(?:ed)?)\b[^.\n]*\bbooking\b/i;
const STILL_OPEN = /^#{1,6}\s*(?:still open|open questions?|not yet confirmed|unconfirmed|open items?|to confirm|outstanding)\b/im;

/** @type {Item} */
export const noteRight = {
  text: '`fixit/march/readiness-note.md` shows where each fact comes from and what is still open',
  check(repo) {
    const text = repo.read(NOTE);
    if (text === null) return `There's no \`${NOTE}\` yet. Write one for Maya: each fact with its source, which sources win, and what's still open.`;
    const sourced = text.split(/\r?\n/).filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l) && NAMES_SOURCE.test(l) && /\S/.test(l.replace(NAMES_SOURCE, '')));
    if (sourced.length < 6) return `The readiness note names a source for ${sourced.length} fact${sourced.length === 1 ? '' : 's'}. Give each fact in the guide the file it comes from, so Maya can check it without asking you.`;
    if (FLYER_FIRST.test(text)) return 'The readiness note puts the flyer above the booking. Which of the two is about March, and which is signed?';
    const open = STILL_OPEN.exec(text);
    if (!open) return 'The readiness note has no section for what\'s still open. Add one, so Maya can see what isn\'t settled.';
    const section = text.slice(open.index).split(/\r?\n(?=#{1,6}\s)/)[0] ?? '';
    if (!/\blift\b|\baccess\b|\bstep[- ]free\b/i.test(section)) return `The readiness note's "${open[0].replace(/^#+\s*/, '')}" section doesn't mention the lift. Line 12 of \`${NOTES}\` says what is still to be confirmed.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [sourcesKept, dateRight, timesRight, capacityRight, accessRight, rulesRight, privacyRight, contactRight, noteRight];
