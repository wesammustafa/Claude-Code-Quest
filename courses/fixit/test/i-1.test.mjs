// i-1's check against what a Learner may leave: the untouched start, the
// two valid descriptions, the manuscript's near misses, Claude's first
// draft kept as it is, a rule that lets our notes win on everything, a
// guide written by hand instead of by the skill, and the line in KIT.md.
// The start is laid as Questerm lays it: the prepared files' inert names
// (dot-claude/, CLAUDE.example.md) restored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i1 = await import(pathToFileURL(join(checks, 'lessons/i-1.mjs')).href);
const [describes, settles, guide, kit] = i1.items;

const LIVE = { 'dot-claude': '.claude', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-1/project']) {
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
const SKILL = text('solutions/i-1/fixit/dot-claude/skills/attendee-guide/SKILL.md');
const TEMPLATE = text('solutions/i-1/fixit/dot-claude/skills/attendee-guide/template.md');
const GUIDE = text('solutions/i-1/fixit/march/attendee-guide.md');
const KIT = text('solutions/i-1/fixit/KIT.md');
const DRAFT = text('test/fixtures/i-1/skill-draft.md');
const LIMITED = text('test/fixtures/i-1/march-guide-limited.md');
const TEMPLATE_PATH = 'fixit/.claude/skills/attendee-guide/template.md';
const DONE = { [i1.SKILL]: SKILL, [TEMPLATE_PATH]: TEMPLATE, [i1.GUIDE]: GUIDE, [i1.KIT]: KIT };

const VALID_A = "Builds the public attendee guide for one Fix-It Saturday session from that month's folder, with a fact table citing a source for every fact. Use when asked to make, draft, update or check an attendee guide or event page. Not for volunteer rotas, internal briefs or meeting notes.";
const VALID_B = "Use to write or refresh the page members of the public read before a Fix-It Saturday (the attendee guide). Don't use it for anything only volunteers see.";
/** SKILL.md with its description replaced. */
const described = (description, skill = SKILL) => skill.replace(/^description: .*$/m, `description: ${description}`);
/** SKILL.md with step 3 replaced. */
const step3 = (line, skill = SKILL) => skill.replace(/^3\. .*$/m, `3. ${line}`);

// A practice copy with `files` over the start; `older` names files saved a
// minute before the rest, as a guide written before the skill's last change.
function copy(files = {}, { older = [] } = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  const then = new Date(Date.now() - 60_000);
  for (const p of older) utimesSync(join(dir, p), then, then);
  return openRepo(dir);
}
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('the untouched start fails every item', () => {
  const r = copy();
  says(describes, r, /There's no `fixit\/\.claude\/skills\/attendee-guide\/SKILL\.md` yet/);
  says(settles, r, /There's no `fixit\/\.claude\/skills\/attendee-guide\/SKILL\.md` yet/);
  says(guide, r, /There's no `fixit\/march\/attendee-guide\.md` yet/);
  says(kit, r, /`fixit\/KIT\.md` doesn't say how to run the skill yet/);
  // The reference copy of the March guide is no guide the skill wrote.
  assert.ok(START['fixit/march/attendee-guide.reference.md']);
});

test('valid A, the solution, passes every item', () => {
  passes(copy(DONE), i1.items);
  assert.match(SKILL, new RegExp(`^description: ${VALID_A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
});

test('valid B, scoped by who reads the page, passes the description item', () => {
  passes(copy({ ...DONE, [i1.SKILL]: described(VALID_B) }), i1.items);
});

test("Claude's first draft kept as it is: the rota request loads it, and nothing settles March's limit", () => {
  const r = copy({ [i1.SKILL]: DRAFT });
  says(describes, r, /^The request "draft the volunteer rota for March" would load the skill: "Helps with Fix-It Saturday documents" fits the rota too\. Name the public page it makes, then say what it's not for in a sentence of its own, starting "Not for"\.$/);
  says(settles, r, /The skill's steps don't say whose word wins on our own arrangements.*booking allows 40 people including volunteers, and our notes cap sign-ups at 30.*Add the rule to step 3/);
});

test("the near misses: every group document loads for the rota and the minutes, and a two-word description misses the check request", () => {
  const broad = copy({ ...DONE, [i1.SKILL]: described("Writes Fix-It Saturday documents from the month's sources, with sources cited.") });
  says(describes, broad, /^The request "draft the volunteer rota for March" would load the skill: "Writes Fix-It Saturday documents from the month's sources, with sources cited" fits the rota too/);
  // Ruling the rota out later doesn't take back a sentence that claims every document.
  const rotaOut = described("Writes Fix-It Saturday documents from the month's sources. Not for the volunteer rota.");
  says(describes, copy({ ...DONE, [i1.SKILL]: rotaOut }), /^The request "draft the volunteer rota for March" would load the skill: "Writes Fix-It Saturday documents from the month's sources" fits the rota too/);
  const minutes = described('Makes and checks the attendee guide. Not for the volunteer rota. Use it to summarise the month\'s meetings too.');
  says(describes, copy({ ...DONE, [i1.SKILL]: minutes }), /^The request "summarise the 20 February meeting" would load the skill: "Use it to summarise the month's meetings too" fits a meeting summary too/);
  says(describes, copy({ ...DONE, [i1.SKILL]: described('Attendee guide.') }), /^The request "can you check the March attendee guide" wouldn't load the skill: its description doesn't say to use it when someone asks to check or update a guide/);
  says(describes, copy({ ...DONE, [i1.SKILL]: described('Checks and updates documents for the Fixers. Not for rotas or minutes.') }), /^The request "make the attendee guide for february" wouldn't load the skill: its description never names the attendee guide/);
});

test('"Not for" reads to the end of its sentence, a bare "not" only three words, and a sentence of its own starts afresh', () => {
  const long = 'Builds the public attendee guide, and checks or updates it. Not for volunteer rotas, internal briefs, schedules or the minutes of any meeting.';
  passes(copy({ ...DONE, [i1.SKILL]: described(long) }), [describes]);
  const never = 'Makes or checks the attendee guide. Never use it for a rota, a volunteers-only brief or a summary of a meeting.';
  passes(copy({ ...DONE, [i1.SKILL]: described(never) }), [describes]);
  const bare = 'Use to make or check the attendee guide, not rotas, briefs or meeting notes.';
  says(describes, copy({ ...DONE, [i1.SKILL]: described(bare) }), /"summarise the 20 February meeting" would load the skill: "Use to make or check the attendee guide, not rotas, briefs or meeting notes" fits a meeting summary too\. .*starting "Not for"/);
  // A negation reaches no further than its own sentence.
  const after = 'Not for rotas. Use it to make and check the attendee guide.';
  passes(copy({ ...DONE, [i1.SKILL]: described(after) }), [describes]);
  // Naming only the public page needs no exclusion.
  passes(copy({ ...DONE, [i1.SKILL]: described('Builds the public attendee guide. Use when asked to make or check an attendee guide.') }), [describes]);
  // A volunteer named outside the exclusion invites the rota.
  says(describes, copy({ ...DONE, [i1.SKILL]: described('Makes and checks the attendee guide that volunteers hand out.') }), /"draft the volunteer rota for March" would load the skill/);
});

test('a name the folder lacks, no description, or a skill that never loads on its own fails by name', () => {
  says(describes, copy({ ...DONE, [i1.SKILL]: SKILL.replace('name: attendee-guide', 'name: guide') }), /names the skill `guide`, so `\/attendee-guide` won't run it/);
  says(describes, copy({ ...DONE, [i1.SKILL]: SKILL.replace(/^description: .*\n/m, '') }), /has no `description:`/);
  says(describes, copy({ ...DONE, [i1.SKILL]: SKILL.replace('---\n\n#', 'disable-model-invocation: true\n---\n\n#') }), /never loads on its own/);
  says(describes, copy({ ...DONE, [i1.SKILL]: SKILL.replace(/^---\n/, '') }), /must start with its frontmatter/);
});

test('a rule that lets our notes win on everything fails with the manuscript\'s words; one confined to our own arrangements passes', () => {
  for (const line of ['Apply the source order in CLAUDE.md. Our notes always win.', 'Apply the source order in CLAUDE.md. When our notes and the venue disagree, our notes win.', 'Apply the source order in CLAUDE.md, but use our notes over the venue for everything.']) {
    says(settles, copy({ ...DONE, [i1.SKILL]: step3(line) }), /^Step 3 now lets our notes beat the venue's confirmation on everything: ".*"\. Limit it to our own arrangements \(sign-up cap, what to bring\)\.$/);
  }
  for (const line of [
    'Apply the source order in CLAUDE.md. The sign-up cap comes from our meeting notes; the room limit from the venue.',
    "Apply the source order in CLAUDE.md. Our notes win on our own arrangements, such as the sign-up cap; the venue wins on everything else.",
    "Apply the source order in CLAUDE.md. Our notes decide what we arrange ourselves: the sign-up cap and what to bring.",
  ])
    passes(copy({ ...DONE, [i1.SKILL]: step3(line) }), [settles]);
  // Our notes may not win on what only the venue sets, even beside our own arrangements.
  for (const line of ["Apply the source order in CLAUDE.md. Our notes win on our own arrangements and on the room's limit.", 'Apply the source order in CLAUDE.md. Our notes win on the sign-up cap and on step-free access.'])
    says(settles, copy({ ...DONE, [i1.SKILL]: step3(line) }), /^Step 3 now lets our notes beat the venue's confirmation on the room itself: ".*"\. The room's limits are the venue's to set\./);
  // A rule that says our notes don't decide the cap is no rule that they do.
  for (const line of ['Apply the source order in CLAUDE.md. The notes never decide the sign-up cap.', "Apply the source order in CLAUDE.md. Don't let our notes set the sign-up cap."])
    says(settles, copy({ ...DONE, [i1.SKILL]: step3(line) }), /don't say whose word wins/);
  passes(copy({ ...DONE, [i1.SKILL]: step3("Apply the source order in CLAUDE.md. Our notes win on the sign-up cap, not the venue's booking.") }), [settles]);
  // Notes that lose to the venue settle nothing about our own arrangements.
  says(settles, copy({ ...DONE, [i1.SKILL]: step3("Apply the source order in CLAUDE.md. Our notes beat old flyers but lose to the venue's booking.") }), /don't say whose word wins/);
  // The standing notes' file name is no rule about our notes.
  assert.match(SKILL, /sources\/group-notes\.md/);
});

test("each step the skill must keep fails by name when it's gone", () => {
  says(settles, copy({ ...DONE, [i1.SKILL]: SKILL.replace(/^2\. .*\n/m, '') }), /don't ask for a fact table/);
  says(settles, copy({ ...DONE, [i1.SKILL]: SKILL.replace('Apply the source order in CLAUDE.md. ', '') }), /don't apply the source order/);
  says(settles, copy({ ...DONE, [i1.SKILL]: SKILL.replace(/^4\. .*\n/m, '') }), /don't say what to do with a detail nobody has confirmed/);
});

test("the March guide: the skill's after the last change passes; a hand-written one from before it fails; wrong limits and a settled lift fail", () => {
  passes(copy({ ...DONE, [i1.GUIDE]: LIMITED }), [guide]);
  // Written by hand before the step 3 rule, or by the skill's first run: older than SKILL.md.
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE }, { older: [i1.GUIDE] }), /^`fixit\/march\/attendee-guide\.md` is older than your last change to the skill.*Run `\/attendee-guide march` again\.$/);
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE.replace('30 places', '40 places') }), /says "Booking: 40 places"\. The booking's 40 includes our ten volunteers/);
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE.replace('30 places. Book on the library\'s events page.', 'No need to book, just turn up.') }), /says "Booking: No need to book, just turn up"/);
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE.replace('30 places. ', '') }), /doesn't say how many places there are/);
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE.replace('Step-free access is being confirmed: call', 'The room is step-free. Call') }), /says "The room is step-free" as if it were settled/);
  says(guide, copy({ ...DONE, [i1.GUIDE]: GUIDE.replace(' Step-free access is being confirmed: call the library on 555-0100 before you travel.', '') }), /doesn't say step-free access is being confirmed/);
  // The N7 limit: a guide typed by hand after the last change reads as the skill's.
  passes(copy({ ...DONE, [i1.GUIDE]: GUIDE }, { older: [i1.SKILL] }), [guide]);
});

test("the manuscript's mistake, editing March's guide to say 30 instead of the skill, leaves the skill's rule missing", () => {
  const r = copy({ ...DONE, [i1.SKILL]: described(VALID_A, DRAFT), [i1.GUIDE]: GUIDE });
  passes(r, [describes, guide, kit]);
  says(settles, r, /don't say whose word wins on our own arrangements/);
});

test('KIT.md says how to run the skill: its name and the folder to give it', () => {
  for (const line of ['2. Type `/attendee-guide <month>` in a Claude session in `fixit/`.', '2. Run the attendee-guide skill with the month\'s folder.', '2. `/attendee-guide april`'])
    passes(copy({ ...DONE, [i1.KIT]: `${START['fixit/KIT.md']}${line}\n` }), [kit]);
  says(kit, copy({ ...DONE, [i1.KIT]: `${START['fixit/KIT.md']}2. Ask Claude for the guide.\n` }), /doesn't say how to run the skill yet/);
  says(kit, copy({ ...DONE, [i1.KIT]: `${START['fixit/KIT.md']}2. Use the attendee-guide skill.\n` }), /doesn't say how to run the skill yet/);
});
