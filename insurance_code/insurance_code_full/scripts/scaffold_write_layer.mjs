#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function toSlug(input = '') {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPascalFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function parseArgs(argv) {
  const args = { name: '', force: false, dryRun: false, withDto: false, route: '', method: '', path: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (token === '--force') args.force = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--with-dto') args.withDto = true;
    else if (token.startsWith('--route=')) args.route = token.slice('--route='.length);
    else if (token === '--route') {
      args.route = String(argv[i + 1] || '');
      i += 1;
    } else if (token.startsWith('--method=')) args.method = token.slice('--method='.length);
    else if (token === '--method') {
      args.method = String(argv[i + 1] || '');
      i += 1;
    } else if (token.startsWith('--path=')) args.path = token.slice('--path='.length);
    else if (token === '--path') {
      args.path = String(argv[i + 1] || '');
      i += 1;
    }
    else if (token.startsWith('--name=')) args.name = token.slice('--name='.length);
    else if (token === '--name') {
      args.name = String(argv[i + 1] || '');
      i += 1;
    }
  }
  return args;
}

function writeOrThrow(filePath, content, { force, dryRun }) {
  if (fs.existsSync(filePath) && !force) {
    throw new Error(`FILE_EXISTS:${filePath}`);
  }
  if (dryRun) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function appendDtoTemplate({ dtoFilePath, commandType, dryRun }) {
  const marker = `export const to${commandType}Command =`;
  const source = fs.readFileSync(dtoFilePath, 'utf8');
  if (source.includes(marker)) {
    return { appended: false, reason: 'exists' };
  }
  const snippet = `

export const to${commandType}Command = ({ params, body, actor, tenantContext, deps }) => ({
  // TODO: normalize fields
});
`;
  if (!dryRun) fs.writeFileSync(dtoFilePath, `${source}${snippet}`, 'utf8');
  return { appended: true };
}

function buildRepositoryTemplate(slug, commandType) {
  return `export const execute${commandType}Repository = async ({ command }) => {
  // TODO: implement storage operation for ${slug}
  return command;
};
`;
}

function buildUsecaseTemplate(slug, commandType) {
  return `import { execute${commandType}Repository } from '../repositories/${slug}-write.repository.mjs';

export const execute${commandType} = async (command) => execute${commandType}Repository({ command });
`;
}

function buildReadmeSnippet(slug, commandType) {
  return `# Scaffold Result: ${slug}

Generated:

1. \`server/skeleton-c-v1/repositories/${slug}-write.repository.mjs\`
2. \`server/skeleton-c-v1/usecases/${slug}-write.usecase.mjs\`

Manual next steps:

1. Add DTO command in \`server/skeleton-c-v1/dto/write-commands.dto.mjs\`

\`\`\`js
export const to${commandType}Command = ({ params, body, actor, tenantContext, deps }) => ({
  // TODO: normalize fields
});
\`\`\`

2. Wire route:

\`\`\`js
import { to${commandType}Command } from '../dto/write-commands.dto.mjs';
import { execute${commandType} } from '../usecases/${slug}-write.usecase.mjs';
\`\`\`

3. Run checks:

\`\`\`bash
npm run lint:route-write-dto-guard
npm run typecheck
npm run test:smoke:api-core
\`\`\`
`;
}

function buildRouteSnippet({ method, pathValue, commandType, slug }) {
  const normalizedMethod = String(method || '').trim().toLowerCase();
  const allowed = ['post', 'put', 'delete'];
  const m = allowed.includes(normalizedMethod) ? normalizedMethod : 'post';
  const routePath = String(pathValue || '').trim() || '/api/replace/me';
  const depsArg = "deps";
  return `import { to${commandType}Command } from '../dto/write-commands.dto.mjs';
import { execute${commandType} } from '../usecases/${slug}-write.usecase.mjs';

app.${m}('${routePath}', tenantContext, permissionRequired('customer:write'), (req, res) => {
  const command = to${commandType}Command({
    params: req.params,
    body: req.body,
    actor: req.actor,
    tenantContext: req.tenantContext,
    deps: ${depsArg},
  });
  execute${commandType}(command)
    .then((payload) => res.json(payload))
    .catch((err) => res.status(400).json({ code: String(err?.message || 'WRITE_FAILED'), message: '写入失败' }));
});`;
}

function main() {
  const args = parseArgs(process.argv);
  const slug = toSlug(args.name);
  if (!slug) {
    console.error('Usage: node scripts/scaffold_write_layer.mjs --name <feature-slug> [--force] [--dry-run]');
    process.exit(1);
  }

  const commandType = toPascalFromSlug(slug);
  const cwd = process.cwd();
  const repoPath = path.join(cwd, 'server', 'skeleton-c-v1', 'repositories', `${slug}-write.repository.mjs`);
  const usecasePath = path.join(cwd, 'server', 'skeleton-c-v1', 'usecases', `${slug}-write.usecase.mjs`);
  const notePath = path.join(cwd, 'docs', 'reports', `scaffold-${slug}-write-layer.md`);
  const dtoPath = path.join(cwd, 'server', 'skeleton-c-v1', 'dto', 'write-commands.dto.mjs');
  const routePath = args.route ? path.join(cwd, args.route) : '';

  writeOrThrow(repoPath, buildRepositoryTemplate(slug, commandType), args);
  writeOrThrow(usecasePath, buildUsecaseTemplate(slug, commandType), args);
  const hasRouteMeta = Boolean(args.route || args.method || args.path);
  const routeSnippet = hasRouteMeta
    ? `
Route wiring target:

- file: \`${args.route || 'server/skeleton-c-v1/routes/<your-route>.routes.mjs'}\`
- method: \`${String(args.method || 'post').toLowerCase()}\`
- path: \`${args.path || '/api/replace/me'}\`

\`\`\`js
${buildRouteSnippet({ method: args.method, pathValue: args.path, commandType, slug })}
\`\`\`
`
    : '';
  writeOrThrow(notePath, `${buildReadmeSnippet(slug, commandType)}${routeSnippet}`, args);
  let dtoResult = { appended: false, reason: 'skip' };
  if (args.withDto) {
    dtoResult = appendDtoTemplate({ dtoFilePath: dtoPath, commandType, dryRun: args.dryRun });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: args.dryRun,
        slug,
        created: [
          path.relative(cwd, repoPath),
          path.relative(cwd, usecasePath),
          path.relative(cwd, notePath),
        ],
        dto: {
          file: path.relative(cwd, dtoPath),
          ...dtoResult,
        },
        route: hasRouteMeta
          ? {
              file: routePath ? path.relative(cwd, routePath) : args.route,
              method: String(args.method || 'post').toLowerCase(),
              path: args.path || '/api/replace/me',
            }
          : null,
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (err) {
  const message = String(err?.message || err);
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: message.startsWith('FILE_EXISTS:') ? 'FILE_EXISTS' : 'SCAFFOLD_FAILED',
        message,
      },
      null,
      2
    )
  );
  process.exit(1);
}
