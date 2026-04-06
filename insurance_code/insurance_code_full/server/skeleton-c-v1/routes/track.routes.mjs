import { tenantContext } from '../common/access-control.mjs';
import { authOptional } from '../common/middleware.mjs';
import { appendTrackEvent, persistTrackEventsByIds } from '../common/state.mjs';
import { toTrackEventCommand } from '../dto/write-commands.dto.mjs';

export function registerTrackRoutes(app) {
  app.post('/api/track/events', authOptional, tenantContext, async (req, res) => {
    try {
      const command = toTrackEventCommand({
        body: req.body,
        actor: req.actor,
        headers: req.headers,
        tenantContext: req.tenantContext,
        deps: { appendTrackEvent },
      });
      const event = String(command.event || '').trim();
      if (!event) {
        return res.status(400).json({ code: 'EVENT_REQUIRED', message: 'event 不能为空' });
      }
      const tenantId = Number(command.tenantId || 0);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
      }
      const row = appendTrackEvent({
        event,
        properties: command.properties && typeof command.properties === 'object' ? command.properties : {},
        actorType: command.actorType,
        actorId: Number(command.actorId || 0),
        tenantId,
        orgId: Number.isFinite(Number(command.orgId || 0)) && Number(command.orgId || 0) > 0 ? Number(command.orgId) : null,
        teamId: Number.isFinite(Number(command.teamId || 0)) && Number(command.teamId || 0) > 0 ? Number(command.teamId) : null,
        path: String(command.path || ''),
        source: String(command.source || 'web'),
        userAgent: String(command.userAgent || ''),
      });
      await persistTrackEventsByIds([row.id]);
      return res.json({ ok: true });
    } catch (err) {
      const code = String(err?.code || err?.message || '');
      if (code === 'EVENT_REQUIRED') return res.status(400).json({ code, message: 'event 不能为空' });
      if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
      return res.status(400).json({ code: code || 'TRACK_FAILED', message: '事件上报失败' });
    }
  });
}
