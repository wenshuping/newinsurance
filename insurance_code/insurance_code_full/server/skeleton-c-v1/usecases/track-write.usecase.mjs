import { runInStateTransaction } from '../common/state.mjs';
import { appendTrack } from '../repositories/track-write.repository.mjs';

export const executeTrackEvent = async (command) =>
  runInStateTransaction(async () => {
    const event = String(command.event || '').trim();
    if (!event) throw new Error('EVENT_REQUIRED');
    const tenantId = Number(command.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) throw new Error('TENANT_CONTEXT_REQUIRED');
    const properties = command.properties && typeof command.properties === 'object' ? command.properties : {};
    appendTrack({
      command: {
        ...command,
        event,
        tenantId,
        properties,
      },
    });
    command.persistState();
    return { ok: true };
  });
