import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../data/uploads');

export function createUploadWriteDeps(overrides = {}) {
  return {
    uploadsRoot,
    mkdirRecursive: (dir) => fs.mkdir(dir, { recursive: true }),
    writeFileBuffer: (filePath, buf) => fs.writeFile(filePath, buf),
    nowMs: () => Date.now(),
    randomHex: () => Math.random().toString(16).slice(2, 8),
    ...overrides,
  };
}
