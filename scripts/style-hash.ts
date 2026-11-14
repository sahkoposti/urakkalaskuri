import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'style-hash.baseline.json');

const THEME_DIR = path.join(REPO_ROOT, 'src/theme');
const PDF_STYLE_FILES = [
  path.join(REPO_ROOT, 'src/core/pdf/pdfStyles.ts'),
  /** Spec name is core/pdf; file lives under components/pdf in 1.3.5. */
  path.join(REPO_ROOT, 'src/components/pdf/pdfFormStyles.ts'),
];
const SCAN_DIRS = [path.join(REPO_ROOT, 'app'), path.join(REPO_ROOT, 'src')];

export type StyleHashBlockEntry = { index: number; hash: string };

export type StyleHashReport = {
  version: 1;
  theme: Record<string, string>;
  pdf: Record<string, string>;
  blocksByFile: Record<string, StyleHashBlockEntry[]>;
  /** Sorted sha256 of each style block source (path-independent). */
  blockHashes: string[];
};

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function rel(p: string): string {
  return path.relative(REPO_ROOT, p).split(path.sep).join('/');
}

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '__tests__') continue;
      walkSourceFiles(abs, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      acc.push(abs);
    }
  }
  return acc;
}

function readIfExists(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function hashThemeFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of walkSourceFiles(THEME_DIR)) {
    out[rel(file)] = sha256(readIfExists(file));
  }
  return out;
}

function hashPdfFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of PDF_STYLE_FILES) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing PDF style file: ${rel(file)}`);
    }
    out[rel(file)] = sha256(readIfExists(file));
  }
  return out;
}

/** String-aware scan from `openIndex` pointing at `(` or `{`. Returns slice including delimiters. */
function sliceBalanced(source: string, openIndex: number, open: '(' | '{', close: ')' | '}'): string | null {
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let escape = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const c = source[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = c;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
}

function extractStyleSheetCreateObjectBlocks(source: string): string[] {
  const blocks: string[] = [];
  const needle = 'StyleSheet.create';
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const idx = source.indexOf(needle, searchFrom);
    if (idx === -1) break;
    let p = idx + needle.length;
    while (p < source.length && /\s/.test(source[p])) p += 1;
    if (source[p] !== '(') {
      searchFrom = idx + needle.length;
      continue;
    }
    const argStart = p + 1;
    let q = argStart;
    while (q < source.length && /\s/.test(source[q])) q += 1;
    if (source[q] !== '{') {
      searchFrom = argStart;
      continue;
    }
    const objectSlice = sliceBalanced(source, q, '{', '}');
    if (objectSlice) blocks.push(objectSlice);
    searchFrom = q + (objectSlice?.length ?? 1);
  }
  return blocks;
}

/**
 * `createStyles` return objects are hashed too: they are the style payloads passed to
 * `StyleSheet.create` via `useThemedStyles` (this repo’s dominant pattern).
 */
function extractCreateStylesReturnObjects(source: string): string[] {
  const blocks: string[] = [];
  const re = /function\s+createStyles\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const parenOpen = match.index + match[0].length - 1;
    const paramClose = source.indexOf(')', match.index + match[0].length);
    if (paramClose === -1) continue;
    const bodyOpen = source.indexOf('{', paramClose);
    if (bodyOpen === -1) continue;
    const returnMatch = /\breturn\s*\{/g;
    returnMatch.lastIndex = bodyOpen;
    const ret = returnMatch.exec(source);
    if (!ret) continue;
    const braceIndex = ret.index + ret[0].lastIndexOf('{');
    const objectSlice = sliceBalanced(source, braceIndex, '{', '}');
    if (objectSlice) blocks.push(objectSlice);
  }
  return blocks;
}

function extractAllStyleBlocks(source: string): string[] {
  return [...extractStyleSheetCreateObjectBlocks(source), ...extractCreateStylesReturnObjects(source)];
}

export function computeStyleHashReport(): StyleHashReport {
  const theme = hashThemeFiles();
  const pdf = hashPdfFiles();
  const blocksByFile: Record<string, StyleHashBlockEntry[]> = {};
  const blockHashes: string[] = [];

  const files = [...new Set(SCAN_DIRS.flatMap((dir) => walkSourceFiles(dir)))].sort();
  for (const file of files) {
    const source = readIfExists(file);
    const blocks = extractAllStyleBlocks(source);
    if (blocks.length === 0) continue;
    const key = rel(file);
    blocksByFile[key] = blocks.map((block, index) => {
      const hash = sha256(block);
      blockHashes.push(hash);
      return { index, hash };
    });
  }

  blockHashes.sort();

  return {
    version: 1,
    theme,
    pdf,
    blocksByFile,
    blockHashes,
  };
}

export function pathIndependentFingerprint(report: StyleHashReport) {
  return {
    theme: Object.values(report.theme).sort(),
    pdf: Object.values(report.pdf).sort(),
    blockHashes: [...report.blockHashes].sort(),
  };
}

export function writeBaseline(): StyleHashReport {
  const report = computeStyleHashReport();
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function readBaseline(): StyleHashReport {
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as StyleHashReport;
}

function main(): void {
  const write = process.argv.includes('--write');
  if (write) {
    const report = writeBaseline();
    console.log(
      `Wrote ${BASELINE_PATH}: theme=${Object.keys(report.theme).length} pdf=${Object.keys(report.pdf).length} blocks=${report.blockHashes.length}`,
    );
    return;
  }
  const baseline = readBaseline();
  const current = computeStyleHashReport();
  const a = pathIndependentFingerprint(baseline);
  const b = pathIndependentFingerprint(current);
  const match =
    JSON.stringify(a) === JSON.stringify(b);
  if (!match) {
    console.error('Style hash mismatch vs baseline (path-independent fingerprint).');
    console.error('Run: npm run style-hash:write');
    process.exit(1);
  }
  console.log('Style hash OK.');
}

const isMain =
  typeof require !== 'undefined' &&
  require.main === module;
// tsx / esm entry
const invokedDirectly = isMain || process.argv[1]?.endsWith('style-hash.ts');

if (invokedDirectly) {
  main();
}
