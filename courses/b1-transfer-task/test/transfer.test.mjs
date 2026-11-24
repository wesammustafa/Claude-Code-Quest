// The transfer task's Check, which must not judge the listing, and the
// listing's scorer, which must: a full-marks listing, Claude's draft as it
// arrives, and a Learner who rejects every claim Claude made.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, layChecks } from '../tools/lay.mjs';
import { scoreListing } from '../tools/score-listing.mjs';

const checks = layChecks();
const { repo, commit, write } = await import(pathToFileURL(join(checks, 'test/helpers.mjs')).href);
const { openRepo } = await import(pathToFileURL(join(checks, 'repo.mjs')).href);
const task = await import(pathToFileURL(join(checks, 'lessons/b-1.mjs')).href);
const [sources, ready] = task.items;

const START = {};
const root = join(COURSE, 'practice-template/project');
for (const d of readdirSync(root, { withFileTypes: true, recursive: true }))
  if (d.isFile()) {
    const rel = join(d.parentPath ?? d.path, d.name).slice(root.length + 1);
    START[rel] = readFileSync(join(root, rel));
  }
const SOLUTION = readFileSync(join(COURSE, 'solutions/b-1/concert/listing.md'), 'utf8');
const copy = (files = {}) => { const d = repo(START); commit(d, 'start'); write(d, files); return openRepo(d); };

// Claude's draft as the Scenario writes it (scenarios/courses/b1-transfer-task/b-1/files/listing-draft.md in Questerm).
const DRAFT = `# Riverside Community Choir: Spring Concert

Saturday 17 April 2027, 7pm, Hall 2, Hollin Arts Centre.

Fauré's Requiem, then folk songs arranged by the choir's own members.

Tickets £10, under-16s free, from the choir's website or on the door.

Step-free entrance on Mill Lane. Hearing loop available in Hall 2.
`;

test('the Check passes the solution and a wrong listing alike: it judges nothing but the sources and the ready line', () => {
  assert.equal(sources.check(copy({ [task.LISTING]: SOLUTION })), true);
  assert.equal(ready.check(copy({ [task.LISTING]: SOLUTION })), true);
  assert.equal(ready.check(copy({ [task.LISTING]: `${DRAFT}\nReady because Claude wrote it.\n` })), true);
  assert.match(ready.check(copy()), /There's no/);
  assert.match(ready.check(copy({ [task.LISTING]: DRAFT })), /doesn't say why it's ready/);
  assert.match(sources.check(copy({ 'concert/programme-2026.md': 'edited\n' })), /has changed/);
});

const total = (r) => r.time.score + r.tickets.score + r.loop.score + r.access.score + r.ready.score;

test('the solution scores full marks', () => {
  const r = scoreListing(SOLUTION);
  assert.equal(total(r), 5, JSON.stringify(r));
  assert.equal(r.kept, 4);
});

test("accepting Claude's draft keeps its two wrong claims", () => {
  const r = scoreListing(`${DRAFT}\nReady because Claude checked it against the confirmation.\n`);
  assert.equal(r.time.score, 0);
  assert.equal(r.loop.score, 0);
  assert.equal(r.tickets.score, 1);
  assert.equal(r.access.score, 1);
});

test("rejecting every claim Claude made loses the true ones: last year's £8, no access line", () => {
  const rejecter = `# Spring Concert\n\nSaturday 17 April 2027, 7:30pm, Hall 2.\n\nTickets £8 on the door.\n\nReady because I didn't trust Claude and used the 2026 programme and the confirmation; the loop is unconfirmed.\n`;
  const r = scoreListing(rejecter);
  assert.equal(r.time.score, 1);
  assert.equal(r.tickets.score, 0);
  assert.match(r.tickets.why, /£8/);
  assert.equal(r.access.score, 0);
  assert.equal(r.loop.score, 1);
});

test('equivalent wordings score the same', () => {
  const other = `Riverside Community Choir sing Fauré's Requiem and folk songs on Saturday 17 April 2027 at half past seven (doors open 7pm) in Hall 2.\nTickets: £10; under-16s go free. Buy on the choir's website or at the door.\nAccess: step-free via the Mill Lane entrance. We're checking with the Centre whether the hearing loop is working (TBC by 10 April).\nReady because the venue's signed confirmation and the February minutes settle each fact, and the loop is still open.\n`;
  const r = scoreListing(other);
  assert.equal(total(r), 5, JSON.stringify(r));
});
