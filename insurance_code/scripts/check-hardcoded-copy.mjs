import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const ALLOW_LINE_PATTERNS = [
  /\bACTION_COPY\./,
  /\bERROR_COPY\./,
  /\bNOTICE_COPY\./,
  /\bVALIDATION_COPY\./,
  /from\s+['"][^'"]*shared-contracts[^'"]*['"]/, 
];

const CN_RE = /[\u4e00-\u9fff]/;
const offenders = [];

for (const file of walk(SRC_DIR)) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (!CN_RE.test(line)) return;
    if (ALLOW_LINE_PATTERNS.some((re) => re.test(line))) return;
    offenders.push(`${rel}:${idx + 1}: ${line.trim()}`);
  });
}

if (offenders.length) {
  const strict = process.env.HARD_FAIL_COPY_CHECK === '1';
  console.error('[copy-check] Found hardcoded Chinese copy in src (move to shared-contracts):');
  for (const item of offenders) console.error(item);
  if (strict) process.exit(1);
  console.error('[copy-check] WARN mode enabled (set HARD_FAIL_COPY_CHECK=1 to fail build).');
  process.exit(0);
}

console.log('[copy-check] OK: no hardcoded Chinese copy found in src');
