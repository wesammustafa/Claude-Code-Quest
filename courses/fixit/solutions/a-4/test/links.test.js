import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { findLinks, isExternal } from '../src/links.js';
import { brokenLinks } from '../src/check-links.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('finds inline links with their line numbers', () => {
  const links = findLinks('# Title\n\nSee [setup](setup.md) and [library](https://example.com).\n');
  assert.deepEqual(links.map((l) => [l.target, l.line]), [['setup.md', 3], ['https://example.com', 3]]);
});

test('skips images and links inside code', () => {
  const md = '![logo](logo.png)\n`[not](a-link.md)`\n```\n[also not](code.md)\n```\n';
  assert.deepEqual(findLinks(md), []);
});

test('skips links inside an HTML comment', () => {
  const md = 'See [setup](setup.md).\n<!-- Old rota: [rota](old-rota.md) -->\n';
  assert.deepEqual(findLinks(md).map((l) => l.target), ['setup.md']);
});

test('skips links inside an HTML comment over several lines', () => {
  const md = '<!-- Draft directions:\n[getting there](directions.md)\n-->\nSee [setup](setup.md).\n';
  assert.deepEqual(findLinks(md).map((l) => [l.target, l.line]), [['setup.md', 4]]);
});

test('finds links that have a title', () => {
  const links = findLinks('See [setup](setup.md "Setting up") and [rules](rules.md \'House rules\').\n');
  assert.deepEqual(links.map((l) => l.target), ['setup.md', 'rules.md']);
});

test('tells external links from relative ones', () => {
  assert.equal(isExternal('https://example.com'), true);
  assert.equal(isExternal('mailto:events@example.com'), true);
  assert.equal(isExternal('events/setup.md'), false);
});

test('reports only the relative links whose file is missing', () => {
  const broken = brokenLinks(fixtures, { files: ['.'], ignore: [] });
  assert.deepEqual(broken, [{ file: 'events.md', line: 5, target: 'old-rota.md' }]);
});
