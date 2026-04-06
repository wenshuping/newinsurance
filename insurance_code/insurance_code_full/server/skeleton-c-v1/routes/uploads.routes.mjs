import { permissionRequired, tenantContext } from '../common/access-control.mjs';
import { createUploadWriteDeps } from '../common/upload-write.deps.mjs';
import { toUploadBase64Command } from '../dto/write-commands.dto.mjs';
import { executeUploadBase64 } from '../usecases/upload-write.usecase.mjs';

export function registerUploadsRoutes(app) {
  const uploadDeps = createUploadWriteDeps();
  app.post('/api/uploads/base64', tenantContext, permissionRequired('customer:write'), async (req, res) => {
    try {
      const command = toUploadBase64Command({
        body: req.body,
        tenantContext: req.tenantContext,
        headers: req.headers,
        protocol: req.protocol,
        host: req.get('host'),
        deps: uploadDeps,
      });
      const payload = await executeUploadBase64(command);
      return res.json(payload);
    } catch (err) {
      const code = String(err?.code || err?.message || 'UPLOAD_FAILED');
      if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
      if (code === 'INVALID_DATA_URL') return res.status(400).json({ code, message: '上传内容格式错误' });
      if (code === 'FILE_TOO_LARGE') return res.status(413).json({ code, message: '文件过大，单文件最大 12MB' });
      return res.status(500).json({ code: 'UPLOAD_FAILED', message: err?.message || '上传失败' });
    }
  });
}
