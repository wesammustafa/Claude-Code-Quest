// The pilot capstone's check against the guides a Learner may hand over:
// the two exemplars, the near miss, Claude's two first drafts, and one
// mistake per item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const cap = await import(pathToFileURL(join(checks, 'lessons/b-capstone.mjs')).href);
const [sources, date, times, capacity, access, rules, privacy, contact, note] = cap.items;

const read = (p) => readFileSync(join(COURSE, p), 'latin1');
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/b-capstone/project']) {
  const walk = (rel = '') => {
    for (const e of readdirSync(join(COURSE, dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else START[r] = readFileSync(join(COURSE, dir, r));
    }
  };
  walk();
}
const text = (p) => readFileSync(join(COURSE, p), 'utf8');
const A = text('solutions/b-capstone/fixit/march/attendee-guide.md');
const NOTE = text('solutions/b-capstone/fixit/march/readiness-note.md');
const fixture = (name) => text(`test/fixtures/b-capstone/${name}`);

function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const guideItems = [date, times, capacity, access, rules, privacy, contact];
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('exemplar A and its readiness note pass every item, the PDF and PNG untouched', () => {
  passes(copy({ [cap.GUIDE]: A, [cap.NOTE]: NOTE }), cap.items);
});

test('exemplar B, access first and no number of places, passes the guide items', () => {
  passes(copy({ [cap.GUIDE]: fixture('attendee-guide-B.md') }), guideItems);
});

test('the near miss fails on capacity, access and the new rule, and nothing else', () => {
  const r = copy({ [cap.GUIDE]: fixture('attendee-guide-near-miss.md') });
  says(capacity, r, /40 places.*occupancy line to the end of the sentence/);
  says(access, r, /accessible by lift.*Line 12/);
  says(rules, r, /new this month/);
  passes(r, [date, times, privacy, contact]);
});

test("Claude's weak draft fails on times, 60, step-free, the new rule and Priya's number", () => {
  const r = copy({ [cap.GUIDE]: fixture('draft-weak.md') });
  says(times, r, /10am/);
  says(capacity, r, /60 seats.*flyer/);
  says(access, r, /step-free/);
  says(rules, r, /new this month/);
  says(privacy, r, /555-0187/);
});

test("Claude's strong draft is wrong only about the 40", () => {
  const r = copy({ [cap.GUIDE]: fixture('draft-strong.md') });
  says(capacity, r, /Up to 40 places/);
  passes(r, [date, times, access, rules, privacy, contact]);
});

test('40 is fine where it says whose limit it is, and 30 or no number both pass', () => {
  const with40 = A.replace('**Booking:** 30 places.', '**Booking:** 30 places: the room holds 40 including our ten volunteers.');
  passes(copy({ [cap.GUIDE]: with40 }), [capacity]);
  says(capacity, copy({ [cap.GUIDE]: A.replace('30 places', '35 places') }), /caps March sign-ups at 30/);
  says(capacity, copy({ [cap.GUIDE]: A.replace(/\*\*Booking:\*\*.*\n/, '**Places:** 30. If there is space at 11:00, we take walk-ins.\n') }), /No line tells people to book/);
});

test('access: unanswered fails, plain "step-free" fails, a lift that is being checked passes', () => {
  const noAccess = A.replace(/\*\*Getting to Room B:\*\*.*\n/, '');
  says(access, copy({ [cap.GUIDE]: noAccess.replace(/first floor/g, 'Room B') }), /doesn't say how to get to Room B/);
  says(access, copy({ [cap.GUIDE]: A.replace(/\*\*Step-free access is being confirmed:\*\* the lift has had repairs\. Call the library on 555-0100 before you travel and we'll tell you\./, 'Room B is step-free.') }), /step-free/);
  passes(copy({ [cap.GUIDE]: A.replace(/\*\*Step-free access.*\n/, 'There is a lift; please call 555-0100 to check it is working before you travel.\n') }), [access]);
});

test("adding Priya's number, as she asks, fails; a missing desk number fails", () => {
  says(privacy, copy({ [cap.GUIDE]: A.replace('Call the library on 555-0100', 'Text Priya on 555 0187') }), /555 0187.*Maya's brief/);
  says(contact, copy({ [cap.GUIDE]: A.replace(/555-0100/g, 'the events desk') }), /no number to call/);
});

test('the readiness note: missing, no limit, flyer first and no lift each fail', () => {
  says(note, copy({ [cap.GUIDE]: A }), /There's no/);
  says(note, copy({ [cap.NOTE]: '# Ready\n\nIt all looks right to me.\n' }), /doesn't give Maya the public limit/);
  says(note, copy({ [cap.NOTE]: `${NOTE}\nThe flyer wins over the booking when they disagree.\n` }), /puts the flyer above the booking/);
  says(note, copy({ [cap.NOTE]: NOTE.replace(/## Still open[\s\S]*?(?=## How I checked)/, '').replace(/- If the lift.*\n/, '') }), /doesn't say the lift is still to be confirmed/);
});

// The two notes that used to pass: a valid guide with a note that claims 40
// public places, and six fillers with a bare "Lift" under Still open.
test('the reported false passes: 40 public places, and six fillers with a bare Lift', () => {
  const forty = NOTE.replace('| 30 places | meeting notes 20 Feb, "Cap March sign-ups at 30" |', '| 40 public places | booking, "Maximum occupancy: 40" |');
  says(note, copy({ [cap.GUIDE]: A, [cap.NOTE]: forty }), /"40 public places".*occupancy line to the end of the sentence.*line 11/);
  const filler = `# Note\n\n${Array(6).fill('- The booking is my source').join('\n')}\n\n## Still open\n\n- Lift\n`;
  says(note, copy({ [cap.GUIDE]: A, [cap.NOTE]: filler }), /"The booking is my source" 6 times/);
});

test('the note contradicts itself: a second, wrong limit, or a lift that works', () => {
  says(note, copy({ [cap.NOTE]: `${NOTE}\n- Up to 40 people can sign up, as the booking says.\n` }), /"Up to 40 people can sign up/);
  says(note, copy({ [cap.NOTE]: `${NOTE}\n- The lift is working again (booking).\n` }), /"The lift is working again.*Line 12/);
  says(note, copy({ [cap.NOTE]: NOTE.replace(/- \*\*Step-free access\.\*\*.*\n/, '- Step-free access: confirmed, the lift is fixed.\n') }), /confirmed, the lift is fixed/);
});

test('right numbers on the wrong facts fail, each pointing at its source', () => {
  const row = (r) => NOTE.replace(/\| 30 places \|.*\n/, `${r}\n`);
  says(note, copy({ [cap.NOTE]: row('| 30 places, with 30 volunteers | meeting notes 20 Feb | |') }), /30 volunteers.*how many volunteers/);
  says(note, copy({ [cap.NOTE]: row('| 10 places for the public | meeting notes 20 Feb: ten volunteers, 40 in the room | |') }), /10 places for the public.*caps March sign-ups at 30/);
  says(note, copy({ [cap.NOTE]: row('| 30 places | the room holds 30 including volunteers (booking) | |') }), /room holds 30.*room's limit/);
});

test('a limit with no evidence that explains it, and filler that names no fact, fail', () => {
  const bare = '# For Maya\n\n- 30 places: booking-confirmation-march.pdf\n- Date and times: the booking\n- Room B: the booking\n- Contact 555-0100: your brief\n\n## Still open\n- Whether the lift works: Priya is confirming.\n';
  says(note, copy({ [cap.NOTE]: bare }), /not why it's 30 when the booking says 40.*Line 14.*line 11/);
  const vague = '# For Maya\n\n30 places, the cap from the 20 Feb meeting notes.\n\nI used the booking.\n\nI read the group notes too.\n\nThe lift isn\'t confirmed yet: Priya is checking.\n';
  says(note, copy({ [cap.NOTE]: vague }), /names a source for 1 of the guide's facts \(the places\).*the date, the times/);
  says(note, copy({ [cap.NOTE]: NOTE.replace(/## Still open\n[\s\S]*?(?=\n## How)/, '## Still open\n- Lift\n').replace(/- If the lift.*\n/, '') }), /"Lift" but not where the lift stands/);
});

test('valid notes in other shapes pass: short prose, a list, a table with no Still open heading', () => {
  const prose = "Maya, the guide is ready apart from one thing. The date, times and Room B are from the signed booking. The 30 places are the cap from the 20 February meeting notes; the booking's 40 counts our volunteers and library staff. What we can't take is from the group notes, with the e-bike rule from the meeting notes, and the number is the events desk's, as your brief asks. Not settled yet: whether the lift works. Priya is checking after the engineer's visit.\n";
  passes(copy({ [cap.GUIDE]: A, [cap.NOTE]: prose }), cap.items);
  const list = '# Readiness\n\n- Saturday 13 March, 10:30 to 1pm, Room B: booking, Date, Public admission and Room lines\n- Thirty places: meeting notes line 11 (ten volunteers plus thirty visitors stays inside the room\'s 40)\n- Book on the events page: group notes, Booking\n- Can\'t take e-bike batteries: meeting notes, new rule\n- Contact 555-0100: BRIEF.md line 16\n\n## Open\n- Lift: TBC by Priya with the library.\n';
  passes(copy({ [cap.GUIDE]: A, [cap.NOTE]: list }), cap.items);
  const table = '| Fact | Where it comes from |\n|---|---|\n| 13 March, 10:30 to 1pm | booking-confirmation-march-text.md lines 10 and 12 |\n| 30 public places | meeting-notes-2027-02-20.md line 11; the booking\'s 40 includes volunteers |\n| Book on the events page | group-notes.md line 18 |\n| No microwaves, gas, damaged batteries, e-bike batteries | group-notes.md lines 11 to 15; meeting notes line 13 |\n| 555-0100 | BRIEF.md line 16 |\n| Step-free access | not yet confirmed: Priya is to confirm the lift works (meeting notes line 12) |\n';
  passes(copy({ [cap.GUIDE]: A, [cap.NOTE]: table }), cap.items);
});

test('the guide states a limit: 30 places, or places are limited, and never a wrong count', () => {
  const book = A.replace(/\*\*Booking:\*\*.*\n/, '**Booking:** book on the library\'s events page.\n');
  says(capacity, copy({ [cap.GUIDE]: book }), /doesn't say there's a limit/);
  passes(copy({ [cap.GUIDE]: book.replace('book on', 'places are limited, so book on') }), [capacity]);
  passes(copy({ [cap.GUIDE]: book.replace('book on', 'the room holds 40 people including our volunteers, so places are limited: book on') }), [capacity]);
  says(capacity, copy({ [cap.GUIDE]: A.replace('30 places.', '30 places. Our 30 volunteers will help.') }), /30 volunteers/);
  says(capacity, copy({ [cap.GUIDE]: A.replace('30 places.', '30 places, or 40 places if you book early.') }), /40 places if you book early.*occupancy line/);
});

test('editing a source fails: the text version, the scan and the flyer photo all count', () => {
  says(sources, copy({ 'fixit/march/booking-confirmation-march-text.md': 'edited\n' }), /booking-confirmation-march-text\.md` has changed/);
  says(sources, copy({ 'fixit/march/booking-confirmation-march.pdf': Buffer.from('not a pdf') }), /booking-confirmation-march\.pdf` has changed/);
  void read;
});

test('head counts are read for what they count', () => {
  const kinds = (t) => cap.headcounts(t).map((h) => `${h.n} ${h.kind}`).join(', ');
  assert.equal(kinds('40 places minus our 10 volunteers leaves 30 public places'), '40 total, 10 volunteers, 30 public');
  assert.equal(kinds('Booking allows 40 people, but that includes the volunteers'), '40 total');
  assert.equal(kinds('The room takes 40, so with ten volunteers we cap bookings at 30'), '40 total, 10 volunteers, 30 public');
  assert.equal(kinds('Up to 30 people can book; 30 volunteers'), '30 public, 30 volunteers');
  assert.equal(kinds('Doors at 10:30; walk-ins at 11 if space; 20 Feb notes line 11'), '');
});

test('a 10am start in other forms fails: 10.00am, "doors open at 10", "10 to 1pm"', () => {
  const when = '**When:** Saturday 13 March 2027, 10:30am to 1pm. Please don\'t arrive before 10:30; we\'re setting up.';
  for (const said of ['**When:** Saturday 13 March 2027, 10.00am to 1pm. Please don\'t arrive before 10:30.', '**When:** Saturday 13 March 2027, 10:30am to 1pm. Doors open at 10.', '**When:** Saturday 13 March 2027, 10 to 1pm. Public from 10:30.'])
    says(times, copy({ [cap.GUIDE]: A.replace(when, said) }), /booking admits the public from 10:30/);
  passes(copy({ [cap.GUIDE]: A.replace(when, '**When:** Saturday 13 March 2027, 10.30am to 1pm. Doors open at 10:30, with fixers at 10 tables.') }), [times]);
});

test('access promised in other words fails: "lift access", wheelchair users can take the lift', () => {
  const getting = /\*\*Getting to Room B:\*\*.*\n/;
  for (const said of ['**Getting to Room B:** lift access to Room B, first floor.', "**Getting to Room B:** wheelchair users can take the lift by the children's library."])
    says(access, copy({ [cap.GUIDE]: A.replace(getting, `${said}\n`) }), /Line 12/);
  passes(copy({ [cap.GUIDE]: A.replace(getting, "**Getting to Room B:** there's a lift by the children's library, but we're still confirming it works: call 555-0100 before you travel.\n") }), [access]);
});
