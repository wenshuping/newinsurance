#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const projectRoot = process.cwd();
  const scaffoldScript = path.join(projectRoot, 'scripts', 'scaffold_write_layer.mjs');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-write-layer-'));

  try {
    ensureDir(path.join(tmpRoot, 'server', 'skeleton-c-v1', 'repositories'));
    ensureDir(path.join(tmpRoot, 'server', 'skeleton-c-v1', 'usecases'));
    ensureDir(path.join(tmpRoot, 'server', 'skeleton-c-v1', 'dto'));
    ensureDir(path.join(tmpRoot, 'docs', 'reports'));

    const dtoPath = path.join(tmpRoot, 'server', 'skeleton-c-v1', 'dto', 'write-commands.dto.mjs');
    fs.writeFileSync(
      dtoPath,
      "const toStringOrEmpty=(v)=>String(v??'').trim();\nexport const toExampleCommand=({body})=>({name:toStringOrEmpty(body?.name)});\n",
      'utf8'
    );

    execFileSync(
      process.execPath,
      [
        scaffoldScript,
        '--name',
        'smoke-write-flow',
        '--with-dto',
        '--route',
        'server/skeleton-c-v1/routes/smoke.routes.mjs',
        '--method',
        'post',
        '--path',
        '/api/smoke/write',
      ],
      { cwd: tmpRoot, stdio: 'pipe' }
    );

    const repositoryPath = path.join(
      tmpRoot,
      'server',
      'skeleton-c-v1',
      'repositories',
      'smoke-write-flow-write.repository.mjs'
    );
    const usecasePath = path.join(
      tmpRoot,
      'server',
      'skeleton-c-v1',
      'usecases',
      'smoke-write-flow-write.usecase.mjs'
    );
    const reportPath = path.join(tmpRoot, 'docs', 'reports', 'scaffold-smoke-write-flow-write-layer.md');

    assert(fs.existsSync(repositoryPath), 'repository scaffold missing');
    assert(fs.existsSync(usecasePath), 'usecase scaffold missing');
    assert(fs.existsSync(reportPath), 'report scaffold missing');

    const dtoSource = fs.readFileSync(dtoPath, 'utf8');
    assert(dtoSource.includes('toSmokeWriteFlowCommand'), 'dto template not appended');

    const reportSource = fs.readFileSync(reportPath, 'utf8');
    assert(reportSource.includes("app.post('/api/smoke/write'"), 'route snippet missing in report');

    console.log(
      JSON.stringify(
        {
          ok: true,
          smoke: 'scaffold-write-layer',
          tempDir: tmpRoot,
          checks: [
            'repository-created',
            'usecase-created',
            'report-created',
            'dto-appended',
            'route-snippet-rendered',
          ],
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

main();
