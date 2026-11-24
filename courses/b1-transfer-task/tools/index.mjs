// Writes, or with --check compares, the pilot's Check index from its
// manifest: the same text the guide's generateCheckIndex gives the guide's
// own index, so a tree assembled from this course passes compileAtPin's check.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { COURSE, GUIDE } from './lay.mjs';

const { generateCheckIndex } = await import(pathToFileURL(join(GUIDE, 'quest/engine/src/content.ts')).href);
const manifest = JSON.parse(readFileSync(join(COURSE, 'course/manifest.json'), 'utf8'));
const path = join(COURSE, 'practice-template/checks/lessons/index.mjs');
const text = generateCheckIndex(manifest);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== text) {
    console.error(`${path} differs from generateCheckIndex(course/manifest.json): run node tools/index.mjs`);
    process.exit(1);
  }
} else writeFileSync(path, text);
