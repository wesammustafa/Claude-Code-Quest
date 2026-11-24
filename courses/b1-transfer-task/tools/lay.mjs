// Lays the pilot's checks over the guide's shared ones in a temporary folder,
// as a practice copy holds them: checks/ from practice-template, then this
// course's checks/lessons/ on top. The pilot's checks import the shared
// modules by the same relative paths the guide's own checks use.
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COURSE = fileURLToPath(new URL('../', import.meta.url));
export const GUIDE = fileURLToPath(new URL('../../../', import.meta.url));

export function layChecks() {
  const root = mkdtempSync(join(tmpdir(), 'transfer-checks-'));
  cpSync(join(GUIDE, 'practice-template/checks'), join(root, 'checks'), { recursive: true });
  cpSync(join(COURSE, 'practice-template/checks'), join(root, 'checks'), { recursive: true });
  return join(root, 'checks');
}
