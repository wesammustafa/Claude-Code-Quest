// Runs the guide's course rules (quest/engine/test/content.test.mjs) on this
// course: assembles a guide tree with this course in place of the default
// one, as Questerm's QSIM_COURSE build does (its tools/lib/course.ts), in a
// temporary folder with the guide's node_modules linked in, then runs the
// rules there. The rules read the course they find: shared rules apply to
// both courses, the developer course's own only where its manifest is the
// guide's. Pass vitest arguments after the script (`-t <name>`, `--reporter`).
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COURSE, GUIDE } from './lay.mjs';

const REPLACED = ['course', 'docs', 'solutions', 'practice-template/project', 'practice-template/capstone', 'courses'];
const out = mkdtempSync(join(tmpdir(), 'fixit-course-rules-'));
execFileSync('tar', ['-x', '-C', out], { input: execFileSync('git', ['-C', GUIDE, 'archive', '--format=tar', 'HEAD'], { maxBuffer: 1 << 30 }) });
// The working tree's own course, so uncommitted edits are what is checked.
for (const path of REPLACED) rmSync(join(out, path), { recursive: true, force: true });
for (const name of readdirSync(COURSE)) {
  if (name === 'test' || name === 'tools' || name === 'README.md') continue;
  cpSync(join(COURSE, name), join(out, name), { recursive: true });
}
cpSync(join(GUIDE, 'quest'), join(out, 'quest'), { recursive: true, filter: (p) => !p.includes('node_modules') });
symlinkSync(join(GUIDE, 'node_modules'), join(out, 'node_modules'));
for (const args of [['init', '-q', '-b', 'main'], ['add', '-A'], ['-c', 'user.name=course rules', '-c', 'user.email=rules@invalid', 'commit', '-q', '-m', 'assembled']])
  execFileSync('git', ['-C', out, ...args]);
const run = spawnSync('npx', ['vitest', 'run', 'quest/engine/test/content.test.mjs', ...process.argv.slice(2)], { cwd: out, stdio: 'inherit' });
rmSync(out, { recursive: true, force: true });
process.exit(run.status ?? 1);
