import path from 'path';
import { persistUploadFile } from '../repositories/upload-write.repository.mjs';

const extFromMime = (mime = '') => {
  const normalized = String(mime || '').toLowerCase().trim();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('bmp')) return 'bmp';
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('quicktime')) return 'mov';
  if (normalized.includes('webm')) return 'webm';
  return 'bin';
};

const safeBaseName = (name = '') =>
  String(name || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);

const parseDataUrl = (dataUrl = '') => {
  const raw = String(dataUrl || '').trim();
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) return null;
  return { mime: String(match[1] || '').toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
};

const buildPublicUrl = ({ protocol, host, relPath }) =>
  `${protocol}://${host}/uploads/${relPath.replaceAll(path.sep, '/')}`;

export const executeUploadBase64 = async (command) => {
  const tenantId = Number(command.tenantId || 0);
  if (!Number.isFinite(tenantId) || tenantId <= 0) throw new Error('TENANT_CONTEXT_REQUIRED');

  const parsed = parseDataUrl(command.dataUrl);
  if (!parsed) throw new Error('INVALID_DATA_URL');

  const sizeLimit = 12 * 1024 * 1024;
  if (parsed.buffer.length > sizeLimit) throw new Error('FILE_TOO_LARGE');

  const mime = String(command.type || parsed.mime || 'application/octet-stream');
  const ext = extFromMime(mime);
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const baseName = safeBaseName(command.name || 'upload');
  const fileName = `${command.nowMs()}_${command.randomHex()}_${baseName}.${ext}`;
  const relDir = path.join(`tenant_${tenantId}`, datePart);
  const absDir = path.join(command.uploadsRoot, relDir);
  const relPath = path.join(relDir, fileName);
  const absPath = path.join(command.uploadsRoot, relPath);
  await persistUploadFile({ command, absDir, absPath, buffer: parsed.buffer });

  return {
    ok: true,
    file: {
      name: String(command.name || fileName),
      type: mime,
      size: parsed.buffer.length,
      path: `/uploads/${relPath.replaceAll(path.sep, '/')}`,
      url: buildPublicUrl({ protocol: command.protocol, host: command.host, relPath }),
    },
  };
};
