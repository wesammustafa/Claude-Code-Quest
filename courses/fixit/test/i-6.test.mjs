// i-6's check against what a Learner may leave: the untouched start, valid
// A (the solution: both March findings kept), valid B (the tea line
// changed, in the log and the guide), the manuscript's near misses (a log
// that agrees with the reviewer without a source, and both February
// findings applied), and the mistakes around them: a description of eight
// letters, a reviewer that may edit or has every tool, instructions that let
// the flyer win, a log that cites the fact table, a file that doesn't exist
// or February's findings, a tea line logged as changed in a guide that
// wasn't, and a skill step that applies whatever the reviewer says. The
// start is laid as Questerm lays it: the prepared files' inert names
// (dot-claude/, CLAUDE.example.md) restored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const i6 = await import(pathToFileURL(join(checks, 'lessons/i-6.mjs')).href);
const [reviewer, order, reviewed, february, decided, procedure] = i6.items;

const LIVE = { 'dot-claude': '.claude', 'CLAUDE.example.md': 'CLAUDE.md' };
const START = {};
for (const dir of ['practice-template/project', 'practice-template/lessons/i-6/project']) {
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
const FIRST = text('solutions/i-6/stages/reviewer/guide-reviewer.md');
const ORDERED = text('solutions/i-6/stages/order/guide-reviewer.md');
const AGENT = text('solutions/i-6/fixit/dot-claude/agents/guide-reviewer.md');
const FEB = text('solutions/i-6/fixit/feb/attendee-guide.md');
const FEB_FACTS = text('solutions/i-6/fixit/feb/facts.md');
const LOG = text('solutions/i-6/fixit/march/review-log.md');
const SKILL = text('solutions/i-6/fixit/dot-claude/skills/attendee-guide/SKILL.md');
const MARCH = START[i6.MARCH].toString('utf8');
const DONE = { [i6.AGENT]: AGENT, [i6.FEB]: FEB, 'fixit/feb/facts.md': FEB_FACTS, [i6.LOG]: LOG, [i6.SKILL]: SKILL };

const HEAD = '# Review of the March guide\n\n';
const VALID_B_LOG = `${HEAD}1. Places 30: kept. march/meeting-notes-2027-02-20.md, line 11: "Cap March sign-ups at 30".\n2. Tea is free: changed to "Tea". No source says tea is free: line 14 of march/meeting-notes-2027-02-20.md says "Tea only", and sources/group-notes.md says the session is free.\n`;
const VALID_B_MARCH = MARCH.replace('Tea is free; donations for parts are welcome.', 'Tea; donations for parts are welcome.');
/** The agent file with its frontmatter field `key` replaced by `line`, or removed when `line` is null. */
const field = (key, line, agent = AGENT) => agent.replace(new RegExp(`^${key}:.*\\n`, 'm'), line === null ? '' : `${line}\n`);
/** The skill with step 6 replaced. */
const step6 = (line) => SKILL.replace(/^6\. .*$/m, `6. ${line}`);

function copy(files = {}) {
  const dir = repo(START);
  commit(dir, 'start');
  write(dir, files);
  return openRepo(dir);
}
const passes = (r, items) => { for (const i of items) assert.equal(i.check(r), true, i.text); };
const says = (item, r, re) => { const got = item.check(r); assert.notEqual(got, true, item.text); assert.match(got, re); };

test('the untouched start fails every item', () => {
  const r = copy();
  says(reviewer, r, /^There's no `fixit\/\.claude\/agents\/guide-reviewer\.md` yet\. Ask Claude to create the guide-reviewer subagent/);
  says(order, r, /^There's no `fixit\/\.claude\/agents\/guide-reviewer\.md` yet/);
  says(reviewed, r, /^`fixit\/march\/review-log\.md` has no lines yet/);
  says(february, r, /^The February guide still leaves out a rule on what we can't take: items that need mains rewiring/);
  says(decided, r, /^`fixit\/march\/review-log\.md` has no lines yet/);
  says(procedure, r, /^None of the skill's steps names `guide-reviewer`/);
  // The start holds the hook the kit's guard runs, executable, as i-4 left it.
  assert.ok(START['fixit/.claude/hooks/no-private-numbers.sh']);
  assert.ok(statSync(join(COURSE, 'practice-template/lessons/i-6/project/fixit/dot-claude/hooks/no-private-numbers.sh')).mode & 0o100);
});

test('a hand-written delegation record is no evidence: the check reads none', () => {
  const r = copy({ '.practice/i-6-agents.txt': 'guide-reviewer\n', 'fixit/.practice/i-6-agents.txt': 'guide-reviewer march/attendee-guide.md\n' });
  for (const item of i6.items) assert.notEqual(item.check(r), true, item.text);
});

test('valid A, the solution, passes every item', () => {
  passes(copy(DONE), i6.items);
});

test('valid B, the tea line changed in the log and the guide, passes every item', () => {
  passes(copy({ ...DONE, [i6.LOG]: VALID_B_LOG, [i6.MARCH]: VALID_B_MARCH }), i6.items);
});

test("the near misses: a log that only agrees with the reviewer, and both February findings applied", () => {
  const fine = copy({ ...DONE, [i6.LOG]: `${HEAD}1. fine. 2. fine.\n` });
  says(decided, fine, /^Each line needs the source that decided it: "1\. fine\. 2\. fine" names no source file\.$/);
  const lines = copy({ ...DONE, [i6.LOG]: `${HEAD}1. fine.\n2. fine.\n` });
  says(decided, lines, /^Each line needs the source that decided it: "1\. fine" names no source file\.$/);
  passes(lines, [reviewed]);
  const both = copy({ ...DONE, [i6.FEB]: FEB.replace('10:30am to 1pm', '10am to 1pm') });
  says(february, both, /^The February guide now says 10am: "\*\*When:\*\* Saturday 13 February 2027, 10am to 1pm"\. The January notes say the public comes in from 10:30 .*the flyer the reviewer cited is the oldest source\.$/);
  says(february, copy({ ...DONE, [i6.FEB]: FEB.replace('10:30am to 1pm', '10:00 to 1pm') }), /now says 10am/);
});

test("the reviewer's first draft has every part but its model, and the source order", () => {
  const r = copy({ ...DONE, [i6.AGENT]: FIRST });
  says(reviewer, r, /^The reviewer has no `model:` yet/);
  says(order, r, /^The reviewer's instructions don't say which source wins.*February's hours/);
  const ordered = copy({ ...DONE, [i6.AGENT]: ORDERED });
  passes(ordered, [order]);
  says(reviewer, ordered, /no `model:` yet/);
  // Any model passes: the choice is graded where it's asked, not here.
  for (const model of ['haiku', 'sonnet', 'inherit', 'claude-haiku-4-5']) passes(copy({ ...DONE, [i6.AGENT]: field('model', `model: ${model}`) }), [reviewer]);
});

test('a description must say what the reviewer checks and when, not count words', () => {
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('description', 'description: a b c d e f g h') }), /^The reviewer's description, "a b c d e f g h", doesn't say what it checks/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('description', 'description: Reviews attendee guides.') }), /doesn't say when to use it/);
  passes(copy({ ...DONE, [i6.AGENT]: field('description', 'description: Use when a public page is ready, to check it against its sources.') }), [reviewer]);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('description', null) }), /has no `description:`/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('name', 'name: reviewer') }), /names the agent `reviewer`/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: AGENT.replace(/^---\n/, '') }), /must start with its frontmatter/);
});

test('the reviewer may only read: no tools line, Edit, Bash, Write or an MCP tool fails', () => {
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', null) }), /^With no `tools:` line the reviewer gets every tool/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: "*"') }), /^With no `tools:` line/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: Read, Grep, Glob, Edit') }), /^`tools:` gives the reviewer `Edit`, so it could change what it reviews/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: Read, Bash(grep *)') }), /gives the reviewer `Bash`/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: Read, Write') }), /gives the reviewer `Write`/);
  says(reviewer, copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: Read, mcp__bookings__get_booking') }), /gives the reviewer `mcp__bookings__get_booking`, so it could reach outside the folder/);
  // Fewer read-only tools, or a YAML list of them, still reads only.
  passes(copy({ ...DONE, [i6.AGENT]: field('tools', 'tools: Read, Grep') }), [reviewer]);
  passes(copy({ ...DONE, [i6.AGENT]: AGENT.replace('tools: Read, Grep, Glob\n', 'tools:\n  - Read\n  - Grep\n  - Glob\n') }), [reviewer]);
});

test("instructions that let the flyer win fail; ones that put it last pass", () => {
  const body = (line) => AGENT.replace(/Read CLAUDE\.md for which source wins\. Never report a guide fact as wrong\nbecause an old flyer disagrees with the venue's confirmation\.\n/, `${line}\n`);
  says(order, copy({ ...DONE, [i6.AGENT]: body('Trust the flyer when it disagrees with the guide.') }), /^The reviewer's instructions now let the flyer win: "Trust the flyer when it disagrees with the guide"/);
  says(order, copy({ ...DONE, [i6.AGENT]: body('Read CLAUDE.md. The flyer wins on times.') }), /now let the flyer win: "The flyer wins on times"/);
  passes(copy({ ...DONE, [i6.AGENT]: body('Apply the source order: an old flyer never beats the venue.') }), [order]);
  passes(copy({ ...DONE, [i6.AGENT]: body("Don't trust the flyer over the venue's confirmation.") }), [order]);
  says(order, copy({ ...DONE, [i6.AGENT]: body('Compare the guide with every source.') }), /don't say which source wins/);
});

test('a log line must name a real source, not the fact table, and say what was decided', () => {
  const log = (two) => `${HEAD}1. Places 30: kept. march/meeting-notes-2027-02-20.md, line 11.\n2. ${two}\n`;
  says(decided, copy({ ...DONE, [i6.LOG]: log('Tea is free: kept. march/facts.md agrees.') }), /^"2\. Tea is free: kept\. march\/facts\.md agrees" cites `march\/facts\.md`, which is what the reviewer checked, not a source/);
  says(decided, copy({ ...DONE, [i6.LOG]: log('Tea is free: kept. sources/tea-policy.md says so.') }), /names `sources\/tea-policy\.md`, which isn't a file in the practice copy/);
  says(decided, copy({ ...DONE, [i6.LOG]: log('Tea is free. group-notes.md, line 9.') }), /^"2\. Tea is free\. group-notes\.md, line 9" doesn't say kept or changed/);
  // A bare name is found where the sources live.
  passes(copy({ ...DONE, [i6.LOG]: log('Tea is free: kept. group-notes.md, line 9: "Free".') }), [decided, reviewed]);
  // A finding changed the wrong way: the guide's places raised to the room's limit.
  const raised = `${HEAD}1. Places: changed to 40. march/booking-confirmation-march-text.md, line 14.\n2. Tea is free: kept. sources/group-notes.md, line 9.\n`;
  says(decided, copy({ ...DONE, [i6.LOG]: raised, [i6.MARCH]: MARCH.replace('30 places.', '40 places.') }), /^The March guide now says "\*\*Booking:\*\* 40 places.*our notes cap sign-ups at 30/);
  // A line logged as changed, with the guide as it was.
  says(decided, copy({ ...DONE, [i6.LOG]: VALID_B_LOG }), /^"2\. Tea is free: changed to "Tea"\. .*" says you changed the tea line, but the March guide still says "\*\*How it works:\*\* .*Tea is free/);
});

test("the log answers March's two findings, not February's", () => {
  const feb = `${HEAD}1. Hours 10:30: kept. feb/meeting-notes-2027-01-28.md, line 5.\n2. Rewiring: changed. sources/group-notes.md, line 15.\n`;
  says(reviewed, copy({ ...DONE, [i6.LOG]: feb }), /^"1\. Hours 10:30: kept\. .*" is about February's review\. This log is for the reviewer's March findings: the places and the tea\.$/);
  const placesOnly = `${HEAD}1. Places 30: kept. march/meeting-notes-2027-02-20.md, line 11.\n`;
  says(reviewed, copy({ ...DONE, [i6.LOG]: placesOnly }), /^The log has no line on the reviewer's second March finding, the tea/);
  const teaOnly = `${HEAD}- Tea is free: kept. sources/group-notes.md, line 9.\n`;
  says(reviewed, copy({ ...DONE, [i6.LOG]: teaOnly }), /^The log has no line on the reviewer's first March finding, the places/);
  // Named in any order, as a list or as paragraphs.
  const paragraphs = `${HEAD}Tea is free: kept, sources/group-notes.md line 9.\n\nThe 30 places: kept, march/meeting-notes-2027-02-20.md line 11.\n`;
  passes(copy({ ...DONE, [i6.LOG]: paragraphs }), [reviewed, decided]);
});

test('the February guide gains the rewiring rule in the guide itself, as a rule we refuse', () => {
  says(february, copy({ ...DONE, [i6.FEB]: START[i6.FEB].toString('utf8') }), /still leaves out a rule on what we can't take/);
  // In the fact table alone, or in a comment, nobody reading the guide sees it.
  says(february, copy({ ...DONE, [i6.FEB]: `${START[i6.FEB]}<!-- items that need mains rewiring can't come -->\n` }), /still leaves out a rule/);
  passes(copy({ ...DONE, [i6.FEB]: `${START[i6.FEB]}**Also:** we can't take items that need rewiring inside the casing.\n` }), [february]);
  says(february, copy({ ...DONE, [i6.FEB]: FEB.replace(/^\*\*When:\*\*.*\n/m, '') }), /no longer gives the public hours/);
});

test('the skill hands the written guide to guide-reviewer and treats its findings as leads', () => {
  says(procedure, copy({ ...DONE, [i6.SKILL]: step6('Ask guide-reviewer to check the guide, then apply its fixes.') }), /^Step 6 applies whatever the reviewer reports: .*Treat what it reports as leads/);
  says(procedure, copy({ ...DONE, [i6.SKILL]: step6('Ask guide-reviewer to check the guide against the fact table.') }), /^Step 6 hands the guide to guide-reviewer but doesn't say what to do with what it reports/);
  passes(copy({ ...DONE, [i6.SKILL]: step6("Ask guide-reviewer to check it. Don't apply its findings until you've opened the cited line.") }), [procedure]);
  passes(copy({ ...DONE, [i6.SKILL]: step6('Have the guide-reviewer agent review the guide;\n   check each finding against its source before changing the guide.') }), [procedure]);
  const first = SKILL.replace(/^1\. /m, '1. Ask guide-reviewer to check the guide, and treat its findings as leads.\n2. ').replace(/^6\. .*\n/m, '');
  says(procedure, copy({ ...DONE, [i6.SKILL]: first }), /^Step 1 hands the guide to guide-reviewer before step \d writes it/);
});
