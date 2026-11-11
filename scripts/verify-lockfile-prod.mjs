import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_REF = process.env.LOCKFILE_BASELINE_REF ?? '037cd71';

function snapshot(lock) {
  const out = {};
  for (const [key, pkg] of Object.entries(lock.packages ?? {})) {
    if (!key || pkg.dev === true) continue;
    out[key] = { version: pkg.version, integrity: pkg.integrity ?? null };
  }
  return out;
}

function loadBaseline() {
  const json = execSync(`git show ${BASELINE_REF}:package-lock.json`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return JSON.parse(json);
}

const current = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
const baseline = loadBaseline();
const a = snapshot(baseline);
const b = snapshot(current);

const diffs = [];
const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
for (const key of [...keys].sort()) {
  const left = a[key];
  const right = b[key];
  if (!left || !right) {
    if (left !== right) diffs.push({ key, baseline: left ?? null, current: right ?? null });
    continue;
  }
  if (left.version !== right.version || left.integrity !== right.integrity) {
    diffs.push({ key, baseline: left, current: right });
  }
}

if (diffs.length === 0) {
  console.log(
    `OK: ${Object.keys(b).length} non-dev lockfile entries match baseline ${BASELINE_REF} (0 differences).`,
  );
  process.exit(0);
}

console.error(`FAIL: ${diffs.length} non-dev lockfile entries differ from ${BASELINE_REF}:`);
for (const row of diffs) {
  console.error(JSON.stringify(row));
}
process.exit(1);
