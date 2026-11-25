// The Fix-It course's own sequence: three levels of core lessons, each with
// its optional labs after its capstone. The guide's shared course rules run on it through
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

// The course map's order (docs/curriculum-redesign/02-course-map.md in
// Questerm): each level's six core lessons, capstone last, then its optional
// labs. A lane that builds part of the course has a subset of it, in order.
const ORDER = {
  beginner: ['b-1', 'b-2', 'b-6', 'b-4', 'b-5', 'b-capstone', 'b-3'],
  intermediate: ['i-2', 'i-1', 'i-4', 'i-6', 'i-7', 'i-capstone', 'i-3', 'i-5', 'i-8'],
  advanced: ['a-2', 'a-8', 'a-7', 'a-9', 'a-6', 'a-capstone', 'a-1', 'a-3', 'a-4', 'a-5'],
};
const LABS = ['b-3', 'i-3', 'i-5', 'i-8', 'a-1', 'a-3', 'a-4', 'a-5'];

test("the lessons follow the course map's order, each in its own level, labs after the capstone", () => {
  const all = Object.values(ORDER).flat();
  const ids = PATH.map((p) => p.id);
  assert.deepEqual(ids, all.filter((id) => ids.includes(id)));
  for (const p of PATH) assert.ok(ORDER[p.level]?.includes(p.id), `${p.id} is in level ${p.level}`);
  for (const l of manifest.levels) assert.ok(ORDER[l.id], `level ${l.id}`);
  assert.ok(ids.includes('b-1') && ids.includes('b-capstone'));
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

test('help fades: b-1 opens GUIDED, every capstone is all CHALLENGE', () => {
  const tiers = (id) => byId[id].steps.map((s) => s.tier);
  assert.equal(tiers('b-1')[0], 'guided');
  for (const { id } of PATH) if (id.endsWith('capstone')) assert.ok(tiers(id).every((t) => t === 'challenge'), `${id}: ${tiers(id).join(' ')}`);
});

test('warm-ups recall only a core lesson earlier in the course, and b-1 and the capstones have none', () => {
  const at = Object.fromEntries(PATH.map((p, i) => [p.id, i]));
  for (const { id } of PATH) {
    if (id === 'b-1' || id.endsWith('capstone')) assert.equal(byId[id].warmup.length, 0, `${id} has warm-ups`);
    for (const w of byId[id].warmup) {
      assert.ok(at[w.from] < at[id], `${id} ${w.id} recalls ${w.from}, which is not earlier`);
      assert.ok(!LABS.includes(w.from), `${id} ${w.id} recalls the optional lab ${w.from}`);
    }
  }
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
