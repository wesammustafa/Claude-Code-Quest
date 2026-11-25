// The pilot's own sequence: b-1, b-6, then the capstone, in one Beginner
// level. The guide's shared course rules run on it through
// tools/course-rules.mjs; these are the checks the developer course's own
// rules make of its sequence, made of this one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE, layChecks } from '../tools/lay.mjs';

const engine = (p) => import(pathToFileURL(join(GUIDE, 'quest/engine/src', p)).href);
const { coursePath, parseLesson, parseManifest } = await engine('content.ts');
const { ruleTiers } = await engine('tiers.ts');
const { PROBES, probeError } = await engine('probes.ts');
const { lessons: checks } = await import(pathToFileURL(join(layChecks(), 'lessons/index.mjs')).href);

const manifest = parseManifest(JSON.parse(readFileSync(join(COURSE, 'course/manifest.json'), 'utf8')));
const PATH = coursePath(manifest);
const text = (p) => readFileSync(join(COURSE, p), 'utf8');
const contents = PATH.map((p) => parseLesson(text(`course/steps/${p.id}.md`), `${p.id}.md`, { manifest, checks, probes: { PROBES, probeError } }));
const byId = Object.fromEntries(PATH.map((p, i) => [p.id, contents[i]]));

test('the pilot is b-1, b-6 and the capstone, in that order, in one Beginner level', () => {
  assert.deepEqual(PATH.map((p) => p.id), ['b-1', 'b-6', 'b-capstone']);
  assert.deepEqual(manifest.levels.map((l) => l.id), ['beginner']);
});

test("each step's tier is the course rule's for this sequence, b-6 after b-1", () => {
  const off = [];
  contents.forEach((c, i) => {
    const rule = ruleTiers(contents, i);
    c.steps.forEach((s, k) => {
      if (s.tier !== rule[k]) off.push(`${PATH[i].id} ${s.id} is ${s.tier}; the rule says ${rule[k]}`);
    });
  });
  assert.deepEqual(off, []);
});

test('help fades across the pilot: b-1 opens GUIDED, b-6 never shows every command, the capstone is all CHALLENGE', () => {
  const tiers = (id) => byId[id].steps.map((s) => s.tier);
  assert.equal(tiers('b-1')[0], 'guided');
  assert.ok(!tiers('b-6').includes('guided'), tiers('b-6').join(' '));
  assert.ok(tiers('b-6').includes('challenge'));
  assert.ok(tiers('b-capstone').every((t) => t === 'challenge'));
});

test('warm-ups recall only a lesson earlier in the pilot, and only b-6 has them', () => {
  assert.equal(byId['b-1'].warmup.length, 0);
  assert.equal(byId['b-capstone'].warmup.length, 0);
  assert.ok(byId['b-6'].warmup.length > 0);
  for (const w of byId['b-6'].warmup) assert.equal(w.from, 'b-1', `b-6 ${w.id} recalls ${w.from}`);
});

/** @param {string} dir */
const filesUnder = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
};

test('each lesson opens from its own prepared files, and no starting file is an author solution', () => {
  const solutions = filesUnder(join(COURSE, 'solutions')).filter((p) => !p.endsWith('steps.sh'));
  const answers = new Map(solutions.map((p) => [readFileSync(p).toString('utf8').trim(), relative(COURSE, p)]));
  for (const { id } of PATH) {
    const own = join(COURSE, 'practice-template/lessons', id, 'project');
    assert.ok(filesUnder(own).length > 0, `${id} has no prepared files`);
    for (const p of [...filesUnder(own), ...filesUnder(join(COURSE, 'practice-template/project'))]) {
      const same = answers.get(readFileSync(p).toString('utf8').trim());
      assert.equal(same, undefined, `${relative(COURSE, p)} is the solution ${same}`);
    }
  }
});

test("each stamp is truthful: checked against the documentation, not yet re-run, and the page's sub line agrees", () => {
  for (const { id, page } of PATH) {
    const stamp = byId[id].stamp;
    assert.match(stamp, /^Verified against Claude Code v\d+\.\d+\.\d+ \(stable\) documentation on \d{4}-\d{2}-\d{2}, pilot not yet re-run in a real session$/);
    assert.ok(text(page).split('\n')[2].includes(stamp), `${page} gives another stamp`);
  }
});
