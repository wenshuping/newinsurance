#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const files = [
  {
    path: '.env.example',
    includes: ['DATABASE_URL="postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev"', 'PGSSL="disable"'],
    enforceUrlPolicy: true,
  },
  {
    path: 'deploy/env/runtime-split.dev.env.example',
    includes: ['DATABASE_URL=postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev', 'PGSSL=disable'],
    enforceUrlPolicy: true,
  },
  {
    path: 'deploy/env/runtime-split.staging.env.example',
    includes: ['DATABASE_URL=postgresql://<db_user>:<db_password>@<staging-db-host>:5432/insurance_runtime_staging', 'PGSSL=require'],
    enforceUrlPolicy: true,
  },
  {
    path: 'deploy/env/runtime-split.prod.env.example',
    includes: ['DATABASE_URL=postgresql://<db_user>:<db_password>@<prod-db-host>:5432/insurance_runtime_prod', 'PGSSL=require'],
    enforceUrlPolicy: true,
  },
  {
    path: 'docker-compose.dev.yml',
    includes: ['POSTGRES_DB: insurance_runtime_dev', 'DATABASE_URL: postgresql://insurance:insurance@postgres:5432/insurance_runtime_dev', 'PGSSL: disable'],
    enforceUrlPolicy: true,
  },
  {
    path: 'docker-compose.runtime-split.yml',
    includes: ['POSTGRES_DB: insurance_runtime_dev', 'DATABASE_URL: postgresql://insurance:insurance@postgres:5432/insurance_runtime_dev'],
    enforceUrlPolicy: true,
  },
  {
    path: 'docs/week9-runtime-deployment-baseline-2026-03-07.md',
    includes: ['./week9-runtime-database-url-authority-2026-03-07.md'],
  },
  {
    path: 'server/microservices/README.md',
    includes: ['Week9 DATABASE_URL authority'],
  },
];

const violations = [];

for (const file of files) {
  const absolutePath = path.resolve(root, file.path);
  const content = fs.readFileSync(absolutePath, 'utf8');

  if (file.enforceUrlPolicy && content.includes('postgres://')) {
    violations.push({
      file: file.path,
      reason: 'legacy postgres:// is not allowed; use postgresql://',
    });
  }

  for (const expected of file.includes) {
    if (!content.includes(expected)) {
      violations.push({
        file: file.path,
        reason: `missing expected authority string: ${expected}`,
      });
    }
  }

  if (file.enforceUrlPolicy && content.includes('sslmode=')) {
    violations.push({
      file: file.path,
      reason: 'DATABASE_URL must not include sslmode; use PGSSL separately',
    });
  }
}

const report = {
  ok: violations.length === 0,
  checkedFiles: files.map((item) => item.path),
  violations,
  authority: {
    scheme: 'postgresql://',
    dev: 'postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev',
    staging: 'postgresql://<db_user>:<db_password>@<staging-db-host>:5432/insurance_runtime_staging',
    prod: 'postgresql://<db_user>:<db_password>@<prod-db-host>:5432/insurance_runtime_prod',
    ssl: {
      dev: 'PGSSL=disable',
      staging: 'PGSSL=require',
      prod: 'PGSSL=require',
    },
  },
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
