#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execSync, spawn } from 'node:child_process';

const apiDir = path.resolve(process.cwd());
const envFile = path.join(apiDir, '.env');

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const result = {};
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const runtimeEnv = {
  ...readDotEnv(envFile),
  ...process.env,
};

const workspaceCandidates = [path.resolve(apiDir, '..'), path.resolve(apiDir, '../..')];
const workspaceDir =
  workspaceCandidates.find((dir) => fs.existsSync(path.join(dir, 'insurance_code_B')) && fs.existsSync(path.join(dir, 'insurance_code_P'))) ||
  workspaceCandidates[0];
const bDir = path.join(workspaceDir, 'insurance_code_B');
const pDir = path.join(workspaceDir, 'insurance_code_P');
const runtimeDir = path.join(apiDir, '.runtime');
const logDir = path.join(runtimeDir, 'logs');
const pidFile = path.join(runtimeDir, 'dev-processes.json');
const gatewayBaseUrl = String(runtimeEnv.VITE_API_BASE || 'http://127.0.0.1:4100').replace(/\/+$/, '');
// For local browser testing, keep C端默认走 gateway，避免缺单个微服务时前端局部炸掉。
const userBridgeBaseUrl = String(runtimeEnv.VITE_USER_SERVICE_BASE || gatewayBaseUrl).replace(/\/+$/, '');
const pointsBridgeBaseUrl = String(runtimeEnv.VITE_POINTS_SERVICE_BASE || gatewayBaseUrl).replace(/\/+$/, '');
const adminApiBaseUrl = String(runtimeEnv.VITE_API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const runtimeDatabaseUrl = String(
  runtimeEnv.DATABASE_URL || 'postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev'
).replace(/\/+$/, '');
const runtimePgSsl = String(runtimeEnv.PGSSL || 'disable');
const configuredOcrServiceUrl = String(runtimeEnv.POLICY_OCR_SERVICE_URL || 'http://127.0.0.1:4105').trim().replace(/\/+$/, '');
const configuredOcrServiceToken = String(runtimeEnv.POLICY_OCR_SERVICE_TOKEN || '').trim();
const configuredOcrServiceTimeoutMs = String(runtimeEnv.POLICY_OCR_SERVICE_TIMEOUT_MS || '180000').trim();
const defaultPaddleProjectDir = path.join(runtimeEnv.HOME || process.env.HOME || '', 'Downloads', 'PaddleOCR-main');
const defaultPaddlePython = path.join(defaultPaddleProjectDir, '.venv-paddleocr', 'bin', 'python');
const hasLocalPaddleRuntime = fs.existsSync(defaultPaddleProjectDir) && fs.existsSync(defaultPaddlePython);
const configuredOcrProvider = String(runtimeEnv.POLICY_OCR_PROVIDER || '').trim().toLowerCase() || (hasLocalPaddleRuntime ? 'paddle_local' : 'local');
const configuredOcrPostprocessor = String(runtimeEnv.POLICY_OCR_POSTPROCESSOR || 'none').trim().toLowerCase() || 'none';
const deepseekEnv = {
  DEEPSEEK_API_KEY: String(runtimeEnv.DEEPSEEK_API_KEY || '').trim(),
  DEEPSEEK_BASE_URL: String(runtimeEnv.DEEPSEEK_BASE_URL || '').trim(),
  DEEPSEEK_MODEL: String(runtimeEnv.DEEPSEEK_MODEL || '').trim(),
  DEEPSEEK_FALLBACK_MODEL: String(runtimeEnv.DEEPSEEK_FALLBACK_MODEL || '').trim(),
  DEEPSEEK_TIMEOUT_MS: String(runtimeEnv.DEEPSEEK_TIMEOUT_MS || '').trim(),
  DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT: String(runtimeEnv.DEEPSEEK_ANALYSIS_INCLUDE_OCR_TEXT || '').trim(),
};
const policyOcrEnv =
  configuredOcrProvider === 'paddle_local'
    ? {
        POLICY_OCR_PROVIDER: 'paddle_local',
        POLICY_OCR_PADDLE_PROJECT_DIR: String(runtimeEnv.POLICY_OCR_PADDLE_PROJECT_DIR || defaultPaddleProjectDir).trim(),
        POLICY_OCR_PADDLE_PYTHON: String(runtimeEnv.POLICY_OCR_PADDLE_PYTHON || defaultPaddlePython).trim(),
        POLICY_OCR_PADDLE_DEVICE: String(runtimeEnv.POLICY_OCR_PADDLE_DEVICE || 'cpu').trim(),
        POLICY_OCR_POSTPROCESSOR: configuredOcrPostprocessor,
        POLICY_OCR_OLLAMA_BASE_URL: String(runtimeEnv.POLICY_OCR_OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim(),
        POLICY_OCR_OLLAMA_MODEL: String(runtimeEnv.POLICY_OCR_OLLAMA_MODEL || 'qwen2.5:0.5b').trim(),
        POLICY_OCR_OLLAMA_VISION_MODEL: String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_MODEL || 'qwen2.5vl:3b').trim(),
        POLICY_OCR_OLLAMA_VISION_NUM_CTX: String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_NUM_CTX || '512').trim(),
        POLICY_OCR_OLLAMA_TIMEOUT_MS: String(runtimeEnv.POLICY_OCR_OLLAMA_TIMEOUT_MS || '45000').trim(),
      }
    : {
        POLICY_OCR_PROVIDER: configuredOcrProvider,
        POLICY_OCR_POSTPROCESSOR: configuredOcrPostprocessor,
        POLICY_OCR_OLLAMA_BASE_URL: String(runtimeEnv.POLICY_OCR_OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim(),
        POLICY_OCR_OLLAMA_MODEL: String(runtimeEnv.POLICY_OCR_OLLAMA_MODEL || 'qwen2.5:0.5b').trim(),
        POLICY_OCR_OLLAMA_VISION_MODEL: String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_MODEL || 'qwen2.5vl:3b').trim(),
        POLICY_OCR_OLLAMA_VISION_NUM_CTX: String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_NUM_CTX || '512').trim(),
        POLICY_OCR_OLLAMA_TIMEOUT_MS: String(runtimeEnv.POLICY_OCR_OLLAMA_TIMEOUT_MS || '45000').trim(),
      };

const services = [
  {
    key: 'api-v1',
    name: 'API-V1',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/skeleton-c-v1.mjs'],
    port: 4000,
    readyUrl: 'http://127.0.0.1:4000/api/health',
    timeoutMs: 45000,
    logFile: path.join(logDir, 'api-v1.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      API_PORT: '4000',
      ...deepseekEnv,
      POLICY_OCR_SERVICE_URL: configuredOcrServiceUrl,
      POLICY_OCR_SERVICE_TOKEN: configuredOcrServiceToken,
      POLICY_OCR_SERVICE_TIMEOUT_MS: configuredOcrServiceTimeoutMs,
      ...policyOcrEnv,
    },
  },
  {
    key: 'user-service',
    name: 'USER-SERVICE',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/user-service.mjs'],
    port: 4101,
    readyUrl: 'http://127.0.0.1:4101/health',
    logFile: path.join(logDir, 'user-service.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      API_USER_SERVICE_PORT: '4101',
    },
  },
  {
    key: 'points-service',
    name: 'POINTS-SERVICE',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/points-service.mjs'],
    port: 4102,
    readyUrl: 'http://127.0.0.1:4102/health',
    logFile: path.join(logDir, 'points-service.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      API_POINTS_SERVICE_PORT: '4102',
    },
  },
  {
    key: 'learning-service',
    name: 'LEARNING-SERVICE',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/learning-service.mjs'],
    port: 4103,
    readyUrl: 'http://127.0.0.1:4103/health',
    logFile: path.join(logDir, 'learning-service.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      API_LEARNING_SERVICE_PORT: '4103',
      LEARNING_POINTS_SERVICE_URL: 'http://127.0.0.1:4102',
    },
  },
  {
    key: 'activity-service',
    name: 'ACTIVITY-SERVICE',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/activity-service.mjs'],
    port: 4104,
    readyUrl: 'http://127.0.0.1:4104/health',
    logFile: path.join(logDir, 'activity-service.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      ACTIVITY_SERVICE_PORT: '4104',
      ACTIVITY_POINTS_SERVICE_URL: 'http://127.0.0.1:4102',
    },
  },
  {
    key: 'ocr-service',
    name: 'OCR-SERVICE',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/ocr-service.mjs'],
    port: 4105,
    readyUrl: 'http://127.0.0.1:4105/health',
    logFile: path.join(logDir, 'ocr-service.log'),
    env: {
      API_HOST: '0.0.0.0',
      OCR_SERVICE_PORT: '4105',
      POLICY_OCR_SERVICE_TOKEN: configuredOcrServiceToken,
      POLICY_OCR_FORCE_LOCAL: 'true',
      ...policyOcrEnv,
    },
  },
  {
    key: 'gateway',
    name: 'GATEWAY',
    cwd: apiDir,
    cmd: 'node',
    args: ['server/microservices/gateway.mjs'],
    port: 4100,
    readyUrl: 'http://127.0.0.1:4100/api/health',
    logFile: path.join(logDir, 'gateway.log'),
    env: {
      API_HOST: '0.0.0.0',
      STORAGE_BACKEND: 'postgres',
      DATABASE_URL: runtimeDatabaseUrl,
      PGSSL: runtimePgSsl,
      API_GATEWAY_PORT: '4100',
      GATEWAY_READY_TIMEOUT_MS: '15000',
      GATEWAY_PROXY_TIMEOUT_MS: '60000',
      GATEWAY_ENABLE_V2: 'true',
      GATEWAY_ENABLE_V1_FALLBACK: 'true',
      GATEWAY_V1_BASE_URL: 'http://127.0.0.1:4000',
      GATEWAY_USER_SERVICE_URL: 'http://127.0.0.1:4101',
      GATEWAY_POINTS_SERVICE_URL: 'http://127.0.0.1:4102',
      GATEWAY_ENABLE_LEARNING_SERVICE: 'true',
      GATEWAY_LEARNING_SERVICE_URL: 'http://127.0.0.1:4103',
      GATEWAY_ENABLE_ACTIVITY_SERVICE: 'true',
      GATEWAY_ACTIVITY_SERVICE_URL: 'http://127.0.0.1:4104',
      // Local runtime-split services do not share monolith-backed admin/customer sessions.
      // Keep customer auth and auth-required customer/admin write paths on v1
      // until cross-process auth is unified for manual browser testing.
      GATEWAY_FORCE_V1_PATHS:
        '/api/auth/send-code,/api/auth/verify-basic,/api/me,/api/p/learning/*,/api/p/activities*,/api/b/activity-configs*,/api/sign-in,/api/points/*,/api/redemptions*,/api/orders*,/api/mall/redeem,/api/mall/activities,/api/learning/*,/api/activities',
    },
  },
  {
    key: 'c',
    name: 'C',
    cwd: apiDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3003', '--host=0.0.0.0'],
    port: 3003,
    readyUrl: 'http://127.0.0.1:3003',
    logFile: path.join(logDir, 'c.log'),
    env: {
      VITE_API_BASE: gatewayBaseUrl,
      VITE_USER_SERVICE_BASE: userBridgeBaseUrl,
      VITE_POINTS_SERVICE_BASE: pointsBridgeBaseUrl,
    },
  },
  {
    key: 'b',
    name: 'B',
    cwd: bDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3004', '--host=0.0.0.0'],
    port: 3004,
    readyUrl: 'http://127.0.0.1:3004',
    logFile: path.join(logDir, 'b.log'),
    env: {
      VITE_API_BASE_URL: adminApiBaseUrl,
    },
  },
  {
    key: 'p',
    name: 'P',
    cwd: pDir,
    cmd: 'npm',
    args: ['run', 'dev', '--', '--port=3005', '--host=0.0.0.0'],
    port: 3005,
    readyUrl: 'http://127.0.0.1:3005',
    logFile: path.join(logDir, 'p.log'),
    env: {
      VITE_API_BASE_URL: adminApiBaseUrl,
    },
  },
];

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPids() {
  if (!fs.existsSync(pidFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(pidFile, 'utf8'));
  } catch {
    return {};
  }
}

function writePids(next) {
  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(pidFile, JSON.stringify(next, null, 2));
}

function ensureReady() {
  fs.mkdirSync(logDir, { recursive: true });
}

function startService(svc) {
  const out = fs.openSync(svc.logFile, 'a');
  const child = spawn(svc.cmd, svc.args, {
    cwd: svc.cwd,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      ...(svc.env || {}),
      FORCE_COLOR: '0',
    },
  });
  child.unref();
  return child.pid;
}

function hasRunningManagedProcesses(stored) {
  return services.some((svc) => alive(Number(stored?.[svc.key]?.pid)));
}

function pidsOnPort(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out
      .split(/\s+/)
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0);
  } catch {
    return [];
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, { host = '127.0.0.1', timeoutMs = 20000, intervalMs = 250 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = new net.Socket();
      const finish = (value) => {
        socket.destroy();
        resolve(value);
      };
      socket.setTimeout(intervalMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });
    if (ok) return true;
    await wait(intervalMs);
  }
  return false;
}

async function waitForHttpReady(url, { timeoutMs = 20000, intervalMs = 500 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      // ignore and retry
    }
    await wait(intervalMs);
  }
  return false;
}

async function waitForServiceReady(svc) {
  const timeoutMs = Number(svc.timeoutMs || 20000);
  const portReady = await waitForPort(svc.port, { timeoutMs });
  if (!portReady) return false;
  if (!svc.readyUrl) return true;
  return waitForHttpReady(svc.readyUrl, { timeoutMs });
}

async function stopStartedProcesses(started) {
  for (const record of Object.values(started)) {
    const pid = Number(record?.pid);
    if (alive(pid)) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
  }
  await wait(800);
  for (const record of Object.values(started)) {
    const pid = Number(record?.pid);
    if (alive(pid)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }
}

async function main() {
  ensureReady();
  const stored = readPids();
  if (hasRunningManagedProcesses(stored)) {
    console.error('[dev-start-all] managed stack is already running. Run: npm run dev:stack:stop');
    process.exit(1);
  }

  for (const svc of services) {
    const holders = pidsOnPort(svc.port);
    if (holders.length > 0) {
      console.error(`[dev-start-all] port ${svc.port} is occupied by pid(s): ${holders.join(', ')}`);
      console.error('[dev-start-all] please run: npm run dev:stack:stop');
      process.exit(1);
    }
  }

  const next = {};
  for (const svc of services) {
    const pid = startService(svc);
    next[svc.key] = {
      pid,
      port: svc.port,
      cwd: svc.cwd,
      startedAt: new Date().toISOString(),
      logFile: svc.logFile,
    };
    console.log(`[dev-start-all] started ${svc.name}: pid=${pid} port=${svc.port}`);
    const ready = await waitForServiceReady(svc);
    if (!ready || !alive(pid)) {
      console.error(`[dev-start-all] ${svc.name} failed to become ready on port ${svc.port}`);
      console.error(`[dev-start-all] check log: ${svc.logFile}`);
      await stopStartedProcesses(next);
      writePids({});
      process.exit(1);
    }
    if (svc.port >= 4000 && svc.port < 5000) {
      await wait(400);
    }
  }

  writePids(next);

  console.log('[dev-start-all] all services launched.');
  console.log(`[dev-start-all] source C=${apiDir}`);
  console.log(`[dev-start-all] source B=${bDir}`);
  console.log(`[dev-start-all] source P=${pDir}`);
  console.log(
    '[dev-start-all] C=http://localhost:3003 B=http://localhost:3004 P=http://localhost:3005 GATEWAY=http://localhost:4100 USER=http://localhost:4101 POINTS=http://localhost:4102 LEARNING=http://localhost:4103 ACTIVITY=http://localhost:4104 OCR=http://localhost:4105 API-V1=http://localhost:4000'
  );
  console.log(`[dev-start-all] OCR provider=${configuredOcrProvider}`);
  console.log(`[dev-start-all] OCR service=${configuredOcrServiceUrl}`);
  console.log(
    `[dev-start-all] OCR postprocessor=${configuredOcrPostprocessor} model=${String(runtimeEnv.POLICY_OCR_OLLAMA_MODEL || 'qwen2.5:0.5b').trim()} visionModel=${String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_MODEL || 'qwen2.5vl:3b').trim()} visionNumCtx=${String(runtimeEnv.POLICY_OCR_OLLAMA_VISION_NUM_CTX || '512').trim()}`
  );
  console.log(
    `[dev-start-all] bridge C: VITE_API_BASE=${gatewayBaseUrl} VITE_USER_SERVICE_BASE=${userBridgeBaseUrl} VITE_POINTS_SERVICE_BASE=${pointsBridgeBaseUrl}`
  );
  console.log(`[dev-start-all] bridge B/P: VITE_API_BASE_URL=${adminApiBaseUrl}`);
}

main().catch((err) => {
  console.error('[dev-start-all] error:', err?.message || err);
  process.exit(1);
});
