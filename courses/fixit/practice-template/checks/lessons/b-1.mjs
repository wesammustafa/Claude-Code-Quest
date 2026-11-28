// @ts-check
// Start Claude Code and check what it tells you (Fix-It, Beginner
// lesson 1). The check runs `claude --version` itself, and reads Jordan's
// welcome note the Learner corrects against the library's email: the parking
// line fixed, the extension-leads line kept and marked for Priya to confirm,
// and the note's other true lines kept.
import { runCommand, shellNotFound } from '../command.mjs';
import { claims, OPEN, quote, untouched } from './fixit-claims.mjs';
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Start Claude Code and check what it tells you';

// The longest `claude --version` may run, in milliseconds.
export const VERSION_LIMIT = 30_000;

const VERSION = /^\d+\.\d+\.\d+ \(Claude Code\)/m;
const FIX_PATH = "Open a new terminal window and try again. If it still fails, the install folder isn't on your PATH: follow Troubleshoot installation (step 2 of this lesson links it).";
const NOT_FOUND = "The check couldn't find `claude` on the PATH of the shell it ran in. Run `claude --version` in a new terminal window. If it prints a version there, start the lesson's checks again from that window. If it fails there too, the install folder isn't on your PATH: follow Troubleshoot installation (step 2 of this lesson links it).";

/** @type {Item} */
export const claudeVersion = {
  text: '`claude --version` prints a Claude Code version',
  // It runs on the Learner's machine: a GitHub runner has no Claude Code.
  local: true,
  check(repo) {
    const run = runCommand('claude', ['--version'], { cwd: repo.dir, encoding: 'utf8', timeout: VERSION_LIMIT });
    if (/** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ENOENT' || (!run.error && run.status !== 0 && shellNotFound(run))) return NOT_FOUND;
    if (/** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ETIMEDOUT') return `\`claude --version\` didn't finish within ${VERSION_LIMIT / 1000} seconds. Run it on its own and see what it waits for.`;
    if (run.error) return `The check couldn't run \`claude --version\`: ${run.error.message}`;
    const out = `${run.stdout ?? ''}`;
    if (run.status === 0 && VERSION.test(out)) return true;
    const said = `${out}\n${run.stderr ?? ''}`.trim().split(/\r?\n/)[0] ?? '';
    return `\`claude --version\` printed ${said ? `"${said.slice(0, 120)}"` : 'nothing'}${run.status ? ` and exited with ${run.status}` : ''}, not a line such as \`2.1.0 (Claude Code)\`. ${FIX_PATH}`;
  },
};

export const NOTE = 'fixit/feb/jordan-welcome-note.md';
export const EMAIL = 'fixit/feb/venue-email-feb.md';
export const NOTES = 'fixit/feb/meeting-notes-2027-01-28.md';
const GROUP = 'fixit/sources/group-notes.md';

// Each claim a hint reads, by what it is about.
const PARKING = /\bpark(?:s|ed|ing)?\b|\bcar ?parks?\b/i;
const STATION_ROAD = /\bstation\s+r(?:oa)?d\b/i;
// The library's own car park as somewhere to park: behind the building, on
// site, or the library's car park.
const LIBRARY_PARK = /\blibrary(?:['’]s)?\s+car ?park\b|\bbehind the (?:library|building)\b|\bon[- ]site\b|\bat the library\b|\bour car ?park\b/i;
// A part of a sentence that turns the library's car park away.
const NOT_THERE = /\b(?:closed|shut|isn['’]t open|not open|no parking|unavailable|not available|can['’]t|cannot|can not|don['’]t|do not|doesn['’]t|does not|avoid|never|not (?:the|at|in|use)|instead of|rather than|isn['’]t|is not)\b/i;
// "free" as a price, not "feel free to".
const FREE = /(?<!\bfeel\s)\bfree\b(?!\s+to\b)/i;
const NOT_FREE = /\b(?:not|isn['’]t|is not|never)\s+free\b|\bpaid\b|\bpay\b|\bcharges?\b/i;

const LEADS = /\bextension\b|\bleads\b|\bpower (?:strips?|cables?|cords?)\b/i;
const DENIES = /\b(?:doesn['’]t|does not|don['’]t|do not|won['’]t|will not|no longer|never|can['’]t|cannot)\b[^.;]*\b(?:lend|have|provide|give)\b|\bno (?:extension|leads?)\b/i;

// One part of a sentence at a time, so "don't use the library car park; park
// at Station Road" turns the library away in its own part.
const PART = /[;:!?()]|\.(?=\s|$)|,|\b(?:but|so|instead|while|whereas)\b/i;

/** @param {string} claim */
function sendsToLibrary(claim) {
  return claim.split(PART).some((part) => LIBRARY_PARK.test(part) && !NOT_THERE.test(part));
}

/** @param {string} claim */
function saysFree(claim) {
  return claim.split(PART).some((part) => FREE.test(part) && !NOT_FREE.test(part));
}

/** The note's claims, or the hint for a note the check can't read. @param {Repo} repo */
function readNote(repo) {
  const text = repo.read(NOTE);
  if (text === null) return { error: `\`${NOTE}\` is missing. Reset this step to bring it back, then correct Jordan's parking line.` };
  return { text, lines: claims(text) };
}

/** @type {Item} */
export const parkingCorrected = {
  text: 'the parking line in `fixit/feb/jordan-welcome-note.md` says where volunteers can actually park',
  check(repo) {
    const note = readNote(repo);
    if (note.error !== undefined) return note.error;
    const { text, lines } = note;
    const parking = lines.filter((claim) => PARKING.test(claim));
    if (parking.length === 0) return `No line in the note tells a volunteer where to park. Line 12 of \`${EMAIL}\` says where: write that into the note.`;
    const stale = parking.find(sendsToLibrary);
    if (stale && untouched(repo, NOTE, text)) return `\`${NOTE}\` hasn't changed yet. Open line 12 of \`${EMAIL}\`, read what the library says about its car park on Saturdays, and correct Jordan's parking line.`;
    if (stale) return `The note still sends volunteers to the library's car park: "${quote(stale)}". Line 12 of \`${EMAIL}\` says that car park is closed on Saturdays.`;
    const free = parking.find(saysFree);
    if (free) return `The note says parking is free: "${quote(free)}". Line 12 of \`${EMAIL}\` names Station Road car park but says nothing about what it costs. Write only what the email says.`;
    if (!parking.some((claim) => STATION_ROAD.test(claim))) return `The parking line says where not to park, but not where to go instead. Line 12 of \`${EMAIL}\` names the nearest car park: add it.`;
    return true;
  },
};

/** @type {Item} */
export const leadsMarked = {
  text: 'the extension-leads line is kept and marked for Priya to confirm',
  check(repo) {
    const note = readNote(repo);
    if (note.error !== undefined) return note.error;
    const leads = note.lines.filter((claim) => LEADS.test(claim));
    if (leads.length === 0) return `The note no longer mentions extension leads. Neither \`${EMAIL}\` nor \`${NOTES}\` mentions equipment, so they can't show the line is wrong: keep it, and mark it for Priya to confirm.`;
    if (leads.some((claim) => OPEN.test(claim))) return true;
    const denied = leads.find((claim) => DENIES.test(claim));
    if (denied) return `The note now says "${quote(denied)}". Neither \`${EMAIL}\` nor \`${NOTES}\` says that either: they don't mention equipment at all. Keep Jordan's claim and mark it for Priya to confirm.`;
    return `The leads line still reads as settled: "${quote(leads[0] ?? '')}". Neither \`${EMAIL}\` nor \`${NOTES}\` mentions equipment, so nothing you can open confirms it. Mark it for Priya to confirm, for example "(Priya to confirm)".`;
  },
};

// The note's lines that its sources support, each by what a reworded line
// would still say, and where a learner can read that it's true.
const KEPT = [
  {
    claim: 'Volunteers arrive at 10:00 to set up the tables',
    source: `line 9 of \`${EMAIL}\` (the room is yours from 10:00)`,
    test: (/** @type {string} */ c) => /\b(?:arriv\w*|set(?:ting)?[- ]?up|come in|get in)\b/i.test(c) && /\b(?:10(?:[:.]00)?\s*(?:am|a\.m\.)?|9[:.]30|ten)\b/i.test(c),
  },
  {
    claim: 'Doors open to the public at 10:30',
    source: `line 5 of \`${NOTES}\` ("Public from 10:30")`,
    test: (/** @type {string} */ c) => /\b10[:.]30\b|\bhalf past ten\b/i.test(c) && /\b(?:public|doors?|open\w*|visitors?)\b/i.test(c),
  },
  {
    claim: 'We finish at 1pm and the room has to be clear by 1:30',
    source: `line 9 of \`${EMAIL}\` (clear by 13:30)`,
    test: (/** @type {string} */ c) => /\b(?:1\s*(?:pm|p\.m\.)|13[:.][03]0|1[:.]30|one o['’]?clock|half past one)\b/i.test(c),
  },
  {
    claim: 'Every item gets a repair card',
    source: `line 8 of \`${GROUP}\``,
    test: (/** @type {string} */ c) => /\brepair[- ]cards?\b/i.test(c),
  },
];

/** @type {Item} */
export const othersKept = {
  text: "the note's other true lines are still there",
  check(repo) {
    const note = readNote(repo);
    if (note.error !== undefined) return note.error;
    const lost = KEPT.find((kept) => !note.lines.some((claim) => kept.test(claim)));
    if (lost) return `The note lost a line its sources support: Jordan's "${lost.claim}". It agrees with ${lost.source}, so a new volunteer still needs it. Put it back.`;
    return true;
  },
};

/** @type {Item[]} */
export const items = [claudeVersion, parkingCorrected, leadsMarked, othersKept];
