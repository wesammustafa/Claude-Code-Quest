// @ts-check
// Steer, undo and start fresh (Fix-It, Beginner lesson 4). The check reads
// the files a rewind puts back, never a record the Learner writes: the
// library's email exactly as it arrived, the attendee guide shortened with
// its list of what we can't take, and its parking line after the overnight
// update. Rewind events are not recorded for a check to read, so whether the
// Learner rewound shows only in these files.
import { claims, quote, untouched } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Steer, undo and start fresh';

export const GUIDE = 'fixit/feb/attendee-guide.md';
export const EMAIL = 'fixit/feb/venue-email-feb.md';
const UPDATE = 'fixit/feb/venue-email-feb-update.md';

const plain = (/** @type {string} */ s) => s.replace(/<!--[\s\S]*?-->/g, ' ');
const textLines = (/** @type {string} */ s) => plain(s).split(/\r?\n/).filter((l) => /\S/.test(l));
const words = (/** @type {string} */ s) => plain(s).split(/\s+/).filter((w) => /\w/.test(w)).length;

/**
 * The text `path` had in the copy's first commit, or null when git can't say.
 * @param {Repo} repo
 * @param {string} path
 */
function startText(repo, path) {
  try {
    const [root] = repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n').filter(Boolean);
    return root ? repo.gitLocal('show', `${root}:./${path}`) : null;
  } catch {
    return null;
  }
}

/** @param {Repo} repo */
function readGuide(repo) {
  const text = repo.read(GUIDE);
  if (text === null) return { error: `There's no \`${GUIDE}\`. Rewind to before the request that removed it, or reset this step.` };
  return { text };
}

/** @type {Item} */
export const emailKept = {
  text: '`fixit/feb/venue-email-feb.md` is the email the library sent',
  check(repo) {
    const text = repo.read(EMAIL);
    if (text === null) return `\`${EMAIL}\` is missing. It's the library's email, one of your sources: rewind to before the request that removed it and choose **Restore code**.`;
    if (untouched(repo, EMAIL, text)) return true;
    const start = startText(repo, EMAIL);
    const have = new Set(textLines(text).map((l) => l.trim()));
    const lost = start === null ? undefined : textLines(start).find((l) => !have.has(l.trim()));
    const which = lost ? ` Its line "${quote(lost.trim())}" isn't there any more.` : ' It has lines the library never sent.';
    return `\`${EMAIL}\` isn't the email the library sent.${which} Rebuilding a file from memory misses lines: rewind to before the request that changed it and choose **Restore code and conversation**, so the file comes back exactly.`;
  },
};

// What the group can't take, as the standing notes name it. A claim names
// an item as not accepted when it turns something away itself, or when it
// sits under a heading or lead-in that does ("What we can't take:" and a
// list). The length is `guideShorter`'s job: step W2 verifies this item the
// moment the rewind restores the guide Maya asked to shorten, so it reads
// only what the drift cut.
const NOT_TAKEN = [
  { name: 'microwaves', re: /\bmicrowaves?\b/i },
  { name: 'gas appliances', re: /\bgas\b/i },
  { name: 'batteries that are swollen or cracked', re: /\bbatter(?:y|ies)\b/i },
];
const REFUSES = /\b(?:can['’]?t|cannot|can not|don['’]?t|do not|won['’]?t|will not|not|no|never|unable|refuse\w*|turn\w* away|aren['’]?t|isn['’]?t)\b/i;
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s/;
const LEAD_IN = /^#|:\**\s*$/;

/** Each claim with the heading or lead-in it sits under. @param {string} text */
function underLeads(text) {
  let lead = '';
  return claims(text).map((claim) => {
    const out = { claim, lead };
    if (LEAD_IN.test(claim)) lead = claim;
    else if (!LIST_ITEM.test(claim)) lead = '';
    return out;
  });
}

/** @type {Item} */
export const listKept = {
  text: "the guide still says what we can't take",
  check(repo) {
    const guide = readGuide(repo);
    if (guide.error !== undefined) return guide.error;
    const said = underLeads(guide.text);
    const missing = NOT_TAKEN.filter(({ re }) => !said.some(({ claim, lead }) => re.test(claim) && (REFUSES.test(claim) || REFUSES.test(lead)))).map((n) => n.name);
    if (missing.length) return `The guide no longer says what we can't take: it doesn't turn away ${missing.join(', ').replace(/, ([^,]*)$/, ' or $1')}. Someone will carry one up the stairs. Rewind to before the request that cut the list, then ask again and say the list stays.`;
    return true;
  },
};

// One part of a sentence at a time, so "Station Road is closed, so park on
// Park Lane" keeps the closed car park apart from the open one.
const PART = /[;:!?()]|\.(?=\s|$)|,|\b(?:but|so|since|because|instead|while|whereas|then)\b/i;
const PARKING = /\bpark(?:s|ed|ing)?\b|\bcar ?parks?\b/i;
const STATION_ROAD = /\bstation\s+r(?:oa)?d\b/i;
const PARK_LANE = /\bpark\s+lane\b|\bleisure\s+cent(?:re|er)\b/i;
const NOT_THERE = /\b(?:closed|shut|unavailable|can['’]t|cannot|don['’]t|do not|doesn['’]t|avoid|never|not|no|instead of|rather than|isn['’]t)\b/i;

/** @type {Item} */
export const parkingRight = {
  text: 'the guide sends people to park on Park Lane, not Station Road',
  check(repo) {
    const guide = readGuide(repo);
    if (guide.error !== undefined) return guide.error;
    const about = claims(guide.text).filter((c) => PARKING.test(c) || STATION_ROAD.test(c) || PARK_LANE.test(c));
    const parts = about.flatMap((c) => c.split(PART));
    const stale = parts.find((p) => STATION_ROAD.test(p) && !NOT_THERE.test(p));
    if (stale) return `The guide still sends people to Station Road car park: "${quote(stale.trim())}". Line 6 of \`${UPDATE}\` says it's closed on 13 February for resurfacing.`;
    if (!parts.some((p) => PARK_LANE.test(p) && !NOT_THERE.test(p))) return `The guide doesn't say where to park on 13 February. Line 6 of \`${UPDATE}\` names the leisure centre car park on Park Lane.`;
    return true;
  },
};

// Shorter means by a tenth or more: a terser parking line alone doesn't
// make the guide fit a page.
const SHORTER = 0.9;

/** @type {Item} */
export const guideShorter = {
  text: 'the guide is shorter than the one you started with',
  check(repo) {
    const guide = readGuide(repo);
    if (guide.error !== undefined) return guide.error;
    const start = startText(repo, GUIDE);
    if (start === null) return true;
    const now = words(guide.text);
    const then = words(start);
    if (now > then * SHORTER) return `The guide is ${String(now)} words, about as long as the ${String(then)} you started with. Maya needs it on one printed page under the library's big header: ask Claude to shorten it, and say the list of what we can't take stays.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [emailKept, listKept, parkingRight, guideShorter];
