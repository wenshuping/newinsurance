import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(cDir, '..');
const bDir = path.resolve(workspaceDir, 'insurance_code_B');
const pDir = path.resolve(workspaceDir, 'insurance_code_P');
const apiDir = path.resolve(cDir, 'insurance_code_full');

const checks = [
  { name: 'C contract freeze', cwd: cDir, cmd: 'npm run contracts:freeze:check' },
  { name: 'C copy guard + build', cwd: cDir, cmd: 'npm run ci:c' },
  { name: 'B typecheck + build', cwd: bDir, cmd: 'npm run typecheck && npm run build' },
  { name: 'P typecheck + build', cwd: pDir, cmd: 'npm run typecheck && npm run build' },
  { name: 'API smoke core', cwd: apiDir, cmd: 'npm run test:smoke:api-core' },
];

for (const step of checks) {
  console.log(`\n[release:verify] ${step.name}`);
  console.log(`[release:verify] cwd=${step.cwd}`);
  execSync(step.cmd, { cwd: step.cwd, stdio: 'inherit' });
}

console.log('\n[release:verify] all checks passed');
