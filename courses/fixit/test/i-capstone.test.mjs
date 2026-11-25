// i-capstone's check against what a Learner may leave: the untouched start,
// which holds the kit's three faults; valid A (the solution: the source
// order and the skill's step generalised, the guard widened to every 555-01xx
// number but the venues' public ones, the contacts rule made general); valid
// B (the venue's confirming email in other words, an allow-list guard that
// reads public-contacts.txt, the contacts rule left as it was); the
// manuscript's near miss (Northside named in tier 1, Sam's notes hidden, so
// 50 places and no e-bike rule); the two routes back (a tier 1 that names
// one venue, and the contacts rule widened with the guard left alone); an
// output-only fix, Sam's guide corrected by hand while the kit stays wrong;
// and the mistakes around them. The start is laid as Questerm lays it: the
// prepared files' inert names restored. Hooks run with bash, as Claude Code
// runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const cap = await import(pathToFileURL(join(checks, 'lessons/i-capstone.mjs')).href);
const [sourceOrder, guard, privateFolders, guide, facts, kit, note, mayGuard] = cap.items;

const LIVE = { 'dot-claude': '.claude', 'dot-mcp.json': '.mcp.json', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-capstone/project']) {
  const walk = (rel = '', as = '') => {
    for (const e of readdirSync(join(COURSE, dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const a = as ? `${as}/${LIVE[e.name] ?? e.name}` : (LIVE[e.name] ?? e.name);
      if (e.isDirectory()) walk(r, a);
      else START[a] = readFileSync(join(COURSE, dir, r));
    }
  };
  walk();
}
const text = (p) => readFileSync(join(COURSE, p), 'utf8');
const sol = (p) => text(`solutions/i-capstone/fixit/${p}`);
const fixture = (p) => text(`test/fixtures/i-capstone/${p}`);
const HOOK = 'fixit/.claude/hooks/no-private-numbers.sh';
const LIST = 'fixit/public-contacts.txt';
const SAM_NOTES = 'fixit/april/sam-notes.md';
const at = (p) => START[p].toString('utf8');
const START_CLAUDE = at(cap.CLAUDE);
const START_SKILL = at(cap.SKILL);
const START_SETTINGS = at(cap.SHARED);
const DONE = {
  [cap.CLAUDE]: sol('CLAUDE.example.md'),
  [cap.SKILL]: sol('dot-claude/skills/attendee-guide/SKILL.md'),
  [HOOK]: sol('dot-claude/hooks/no-private-numbers.sh'),
  [cap.GUIDE]: sol('april/attendee-guide.md'),
  [cap.FACTS]: sol('april/facts.md'),
  [cap.KIT]: sol('KIT.md'),
  [cap.NOTE]: sol('april/handoff-note.md'),
};
const TIER1 = /^1\. .*$/m;
const tier1 = (line, from = DONE[cap.CLAUDE]) => from.replace(TIER1, `1. ${line}`);
const step3 = (line, from = DONE[cap.SKILL]) => from.replace(/^3\. .*$/m, `3. ${line}`);
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;
const settingsWith = (change) => {
  const s = JSON.parse(START_SETTINGS);
  change(s);
  return json(s);
};
const CONTACTS_START = "Never put Priya's number, or any number from a `private/` folder or a roster, on a public page. Public enquiries go to the venue's public number.";

// A practice copy with `files` over the start, every script executable
// unless named in `plain`; a null value removes that file.
function copy(files = {}, { plain = [] } = {}) {
  const dir = repo(START);
  for (const p of Object.keys(START)) if (p.endsWith('.sh')) chmodSync(join(dir, p), 0o755);
  commit(dir, 'start');
  write(dir, Object.fromEntries(Object.entries(files).filter(([, v]) => v !== null)));
  for (const [p, v] of Object.entries(files)) {
    if (v === null) rmSync(join(dir, p), { force: true });
    else if (p.endsWith('.sh')) chmodSync(join(dir, p), plain.includes(p) ? 0o644 : 0o755);
  }
  return openRepo(dir);
}
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

const VALID_B = {
  ...DONE,
  [cap.CLAUDE]: tier1("The venue's signed booking, or the venue's confirming email.", START_CLAUDE),
  [cap.SKILL]: step3("Apply the source order in CLAUDE.md: what the venue confirms in writing, signed or by email from its staff, wins on venue facts; our notes win on the sign-up cap and what to bring.", START_SKILL),
  [HOOK]: fixture('no-private-numbers-list.sh'),
  [LIST]: fixture('public-contacts.txt'),
  [cap.KIT]: `${at(cap.KIT)}\n## Limits\n1. Email addresses aren't checked by the hook.\n2. A new venue's public number needs a line in public-contacts.txt first.\n\nTested on: the April session at Northside, 6 April 2027, in a fresh session.\n`,
  [cap.NOTE]: 'Sam, I fixed two things. The source order now counts the venue\'s email, and the guard reads public-contacts.txt, so only the numbers listed there can go on a public page. Check the fact table before you send it to Kofi.\n',
};

test('the untouched start holds the three faults and fails every item but the fence on private folders', () => {
  const r = copy();
  assert.match(START_CLAUDE, /^1\. The venue's signed booking\.$/m);
  assert.ok(START_CLAUDE.includes(CONTACTS_START));
  assert.match(at(HOOK), /555\[ \.-\]\?0187/);
  assert.match(START_SKILL, /^3\. .*The signed booking wins on venue facts/m);
  says(sourceOrder, r, /^Tier 1 still trusts only a signed booking: "The venue's signed booking"\. Kofi's email says the centre doesn't do signed forms/);
  says(guard, r, /^The guard still lets 555-0162, Sam's mobile, onto a public page: it knows only Priya's number/);
  // The fence: a fix must not remove an earlier guard, so it holds at the start.
  passes(r, [privateFolders]);
  says(guide, r, /^There's no `fixit\/april\/attendee-guide\.md` yet\. Run the kit as Sam would/);
  says(facts, r, /^There's no `fixit\/april\/facts\.md` yet/);
  says(kit, r, /^`fixit\/KIT\.md` doesn't say what the kit does not do/);
  says(note, r, /^There's no `fixit\/april\/handoff-note\.md` yet/);
  says(mayGuard, r, /^No guard blocks 555-0168, the caretaker's mobile, on a public page/);
});

test("the start's run, what the faulty kit makes for Sam, fails on the guide and its fact table", () => {
  const r = copy({ [cap.GUIDE]: fixture('attendee-guide-pending.md'), [cap.FACTS]: fixture('facts-pending.md') });
  says(guide, r, /^The April guide still says "\*\*When:\*\* Saturday 10 April 2027, times being confirmed\. Call 555-0130"\. Kofi confirmed/);
  says(facts, r, /^`fixit\/april\/facts\.md` still has the public hours as being confirmed/);
  // Sam's mobile alone, the second fault, is named too.
  says(guide, copy({ [cap.GUIDE]: `${DONE[cap.GUIDE]}**On the day:** ring Sam on 555-0162.\n` }), /^The April guide gives 555-0162: "\*\*On the day:\*\* ring Sam on 555-0162"\. Only a venue's public number/);
});

test('valid A, the solution, passes every item', () => {
  passes(copy(DONE), cap.items);
});

test('valid B, an allow-list guard and the source order in other words, with the contacts rule as it was, passes every item', () => {
  passes(copy(VALID_B), cap.items);
  // The list is data the guard can't run without: with it gone, every edit to a public page is blocked.
  says(guard, copy({ ...VALID_B, [LIST]: null }), /^Your guard also blocks 555-0130, the centre's public number/);
  // A new venue's public number is one line of data.
  const r = copy({ ...VALID_B, [LIST]: `${fixture('public-contacts.txt')}555-0140 St Anne's school office\n` });
  passes(r, cap.items);
});

test("the manuscript's near miss: Northside in tier 1 and Sam's notes hidden fail the source order, the guard and the guide", () => {
  const hidden = settingsWith((s) => s.permissions.deny.push('Read(./april/sam-notes.md)'));
  const r = copy({
    ...DONE,
    [cap.CLAUDE]: tier1("The venue's signed booking. Northside confirms by email: Kofi's email counts.", START_CLAUDE),
    [cap.SKILL]: step3("Apply the source order in CLAUDE.md. The signed booking wins on venue facts, or Kofi's email at Northside; our notes win on our own arrangements.", START_SKILL),
    [HOOK]: at(HOOK),
    [cap.SHARED]: hidden,
    [cap.GUIDE]: fixture('attendee-guide-notes-hidden.md'),
  });
  says(sourceOrder, r, /^Tier 1 names one venue\. The next venue may confirm another way\. Describe the kind of source, not the venue\.$/);
  says(guard, r, /^`Read\(\.\/april\/sam-notes\.md\)` hides Sam's notes, and his cap of 40 and the e-bike reminder with them\. It protects one file in one month/);
  says(guide, r, /^The April guide says "\*\*Booking:\*\* 50 places\..*Sam's notes cap sign-ups at 40\. Claude can't read `april\/sam-notes\.md`: `Read\(\.\/april\/sam-notes\.md\)` denies it/);
  passes(r, [privateFolders, facts]);
});

test('the routes back: a tier 1 that names one venue, and the contacts rule widened with the guard left alone', () => {
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: tier1("The venue's signed booking, or for Northside, the centre's email: Northside confirms by email.") }), /^Tier 1 names one venue\./);
  const guidance = copy({ ...DONE, [HOOK]: at(HOOK) });
  assert.equal(guard.check(guidance), 'The guard still allows 555-0162 on a public page. Guidance worked this time; the guard is what makes it hold every time.');
  says(mayGuard, guidance, /^No guard blocks 555-0168/);
  // The run under that kit leaves Sam's number out, so the guide passes: the guard is what fails.
  passes(guidance, [sourceOrder, guide, facts]);
});

test("an output-only fix, Sam's April guide corrected by hand while the kit stays wrong, fails", () => {
  const r = copy({ [cap.GUIDE]: DONE[cap.GUIDE], [cap.FACTS]: fixture('facts-pending.md'), [cap.KIT]: DONE[cap.KIT], [cap.NOTE]: DONE[cap.NOTE] });
  says(sourceOrder, r, /still trusts only a signed booking/);
  says(guard, r, /still lets 555-0162/);
  says(guide, r, /^The guide reads right, but the kit as it stands can't have made it: tier 1 of its source order still trusts only a signed booking/);
  says(facts, r, /still has the public hours as being confirmed/);
  // The fact table corrected by hand too: the kit is still what fails.
  const both = copy({ [cap.GUIDE]: DONE[cap.GUIDE], [cap.FACTS]: DONE[cap.FACTS] });
  says(guide, both, /can't have made it/);
  says(sourceOrder, both, /still trusts only a signed booking/);
});

test('the source order: the kind of source in any words, flyers still last, and the skill saying the same', () => {
  // An example that names this month's venue is an example, not the rule.
  passes(copy({ ...DONE, [cap.CLAUDE]: tier1("Whatever the venue confirms in writing (for April, Kofi's email at Northside), signed or not.") }), [sourceOrder]);
  passes(copy({ ...DONE, [cap.CLAUDE]: tier1("The venue's written confirmation, such as a signed booking, an email or a text from its staff.") }), [sourceOrder]);
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: tier1('A signed booking, or an email confirming the booking.') }), /^Tier 1 says .*, but not whose\. An email from anyone isn't the venue's confirmation/);
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: tier1("Anything written about the session: the venue's emails, flyers, listings.") }), /^Tier 1 now lets a flyer or a listing win/);
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: DONE[cap.CLAUDE].replace(/^4\. .*\n/m, '') }), /no longer names old flyers and forwarded listings/);
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: DONE[cap.CLAUDE].replace(TIER1, '') }), /has no tier 1/);
  says(sourceOrder, copy({ ...DONE, [cap.SKILL]: START_SKILL }), /^Step 3 of the skill still says the signed booking wins on venue facts: "Apply the source order in CLAUDE\.md\. The signed booking wins/);
  says(sourceOrder, copy({ ...DONE, [cap.SKILL]: step3("Apply the source order in CLAUDE.md. Northside's email wins on venue facts.") }), /^Step 3 of the skill names one venue/);
  // A step that leaves the venue facts to CLAUDE.md says nothing that disagrees with it.
  passes(copy({ ...DONE, [cap.SKILL]: step3('Apply the source order in CLAUDE.md; our notes win on our own arrangements, such as the sign-up cap.') }), [sourceOrder]);
  says(sourceOrder, copy({ ...DONE, [cap.CLAUDE]: null }), /^There's no `fixit\/CLAUDE\.md`/);
});

test('the guard: every number but the public ones, in any spacing, on any month\'s public pages, failing closed', () => {
  const hook = (body) => at(HOOK).replace(/if printf '%s' "\$input" \| grep -Eq '555\[ \.-\]\?0187'; then/, body);
  // Sam's number blocked, but a volunteer's from the roster let through.
  says(guard, copy({ ...DONE, [HOOK]: hook("if printf '%s' \"$input\" | grep -Eq '555[ .-]?01(87|62)'; then") }), /^The guard blocks 555-0162 but lets 555-0175, Jordan's number from the roster, onto a public page/);
  // A guard that blocks only the dash form misses Priya's number with a space.
  says(guard, copy({ ...DONE, [HOOK]: hook("if printf '%s' \"$input\" | grep -Eq '555-01(62|68|75|87)'; then") }), /lets 555 0187, Priya's number, written with a space/);
  // Blocking the centre's own number stops Sam publishing at all.
  says(guard, copy({ ...DONE, [HOOK]: hook("if printf '%s' \"$input\" | grep -Eq '555[ .-]?01[0-9][0-9]'; then") }), /^Your guard also blocks 555-0130, the centre's public number/);
  // Guarding April by name leaves May's guide open.
  const aprilOnly = DONE[HOOK].replace('(/public/[^"]*|/attendee-guide\\.md|/schedule\\.md)', '/april/attendee-guide\\.md');
  assert.notEqual(aprilOnly, DONE[HOOK]);
  const r = copy({ ...DONE, [HOOK]: aprilOnly });
  passes(r, [guard]);
  says(mayGuard, r, /^Your guard blocks 555-0168 on April's guide but not on `may\/attendee-guide\.md`/);
  // Failing closed, and where Sam will have it.
  const settings = (change) => ({ ...DONE, [cap.SHARED]: settingsWith(change) });
  says(guard, copy(settings((s) => { delete s.hooks.PreToolUse[0].hooks[0].onFailure; })), /Add `"onFailure": "block"`/);
  says(guard, copy(settings((s) => { s.hooks.PreToolUse[0].matcher = 'Edit'; })), /your guard runs for Edit only/);
  const local = { ...DONE, [cap.SHARED]: settingsWith((s) => { delete s.hooks; }), [cap.LOCAL]: json({ hooks: JSON.parse(START_SETTINGS).hooks }) };
  says(guard, copy(local), /^The guard is in your local settings/);
  says(guard, copy({ ...DONE, [HOOK]: DONE[HOOK].replace(/\|\| \{ echo "no-private-numbers: could not read the tool input" >&2; exit 2; \}/, '|| exit 0').replace(/\*\) echo "no-private-numbers: no file_path in the tool input" >&2; exit 2 ;;/, '*) exit 0 ;;') }), /when it can't read the input/);
  says(guard, copy({ ...DONE }, { plain: [HOOK] }), /isn't executable/);
  says(guard, copy({ ...DONE, [HOOK]: null }), /there's no such file in `fixit\/`/);
  // A guard on every file, private notes included, is too wide.
  says(guard, copy({ ...DONE, [HOOK]: DONE[HOOK].replace(/^printf '%s' "\$input" \\\n  \| grep -Eq .*\n  \|\| exit 0\n/m, '') }), /blocks 555-0162 in `april\/private\/contacts\.md`, a private note/);
});

test('the fence: removing the read rule for private folders fails, a narrower one too', () => {
  says(privateFolders, copy({ ...DONE, [cap.SHARED]: settingsWith((s) => { s.permissions.deny = s.permissions.deny.filter((x) => !x.includes('private')); }) }), /^The shared settings no longer keep Claude out of the `private\/` folders/);
  says(privateFolders, copy({ ...DONE, [cap.SHARED]: settingsWith((s) => { s.permissions.deny = s.permissions.deny.map((x) => (x.includes('private') ? 'Read(./april/private/**)' : x)); }) }), /covers one month's `private\/` folder only/);
  says(privateFolders, copy({ ...DONE, [cap.SHARED]: '{ "permissions": ' }), /isn't valid JSON/);
});

test("the April guide: Kofi's facts as facts, Sam's arrangements, and the centre's number alone", () => {
  const g = DONE[cap.GUIDE];
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('10:00am to 12:30pm', '10am to 1pm') }), /That's the old flyer's time/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('40 places', 'Just turn up') }), /^The April guide says "\*\*Booking:\*\* Just turn up/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('40 places', '50 places') }), /50 is the hall's limit with the helpers; Sam's notes cap sign-ups at 40\.$/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace(/ \*\*The centre's accessible toilet.*1pm\./, '') }), /accessible toilet is being refurbished/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace(', or e-bike and e-scooter batteries (bikes are fine without them)', '') }), /leaves out the e-bike battery rule/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('Main Hall (ground floor)', 'ground floor') }), /Main Hall/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('step-free main entrance on Grove Street, level floor throughout.', 'main entrance on Grove Street.') }), /step-free/);
  says(guide, copy({ ...DONE, [cap.GUIDE]: g.replace('555-0130.', '555-0130. Volunteers: Ade, 555-0171.') }), /^The April guide gives 555-0171/);
  // The library's public number is a venue's public one too, and "places are limited" a fair limit.
  passes(copy({ ...DONE, [cap.GUIDE]: g.replace('40 places.', 'Places are limited.').replace('555-0130.', '555-0130, or the library desk on 555-0100.') }), [guide]);
});

test('the fact table cites Kofi\'s email for the hours, the room and access, as a table or as lines', () => {
  const f = DONE[cap.FACTS];
  says(facts, copy({ ...DONE, [cap.FACTS]: f.replace('| Room | Main Hall, ground floor | april/venue-email-northside.md, line 10 |', '| Room | Main Hall, ground floor | april/sam-notes.md, line 5 |') }), /doesn't cite Kofi's email, `venue-email-northside\.md`, for the room/);
  passes(copy({ ...DONE, [cap.FACTS]: '# April facts\n\n- Public hours, 10:00 to 12:30: Kofi\'s email, line 12.\n- Room, the Main Hall: Kofi\'s email, line 10.\n- Access, step-free from Grove Street: the venue email, line 14.\n' }), [facts]);
});

test('KIT.md admits at least two limits and names the April test; the note names a part of the kit', () => {
  const k = DONE[cap.KIT];
  says(kit, copy({ ...DONE, [cap.KIT]: k.replace(/## What it does not do\n(?:- .*\n)+/, '## What it does not do\n- It does not catch private email addresses.\n') }), /lists one thing the kit does not do/);
  says(kit, copy({ ...DONE, [cap.KIT]: k.replace(/\n## Last tested\n.*\n/, '\n') }), /doesn't say when the kit was last tested/);
  says(kit, copy({ ...DONE, [cap.KIT]: k.replace(/## Last tested\n.*\n/, '## Last tested\nMarch, by the coordinator.\n') }), /doesn't name April/);
  says(note, copy({ ...DONE, [cap.NOTE]: 'Hi Sam, all sorted. Have a good session!\n' }), /doesn't say which part of the kit you changed/);
  says(note, copy({ ...DONE, [cap.NOTE]: '\n' }), /^There's no `fixit\/april\/handoff-note\.md` yet/);
});

test('hand-written evidence is no evidence: a run record the Learner types changes nothing', () => {
  const r = copy({ '.practice/i-capstone-session.json': '{"fresh":true,"skill":"attendee-guide"}\n', 'fixit/.practice/run.txt': 'attendee-guide ran 2027-04-06\n' });
  for (const item of cap.items.filter((i) => i !== privateFolders)) assert.notEqual(item.check(r), true, item.text);
});
