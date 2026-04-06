export const appendTrack = ({ command }) => {
  command.appendTrackEvent({
    event: command.event,
    properties: command.properties,
    actorType: command.actorType,
    actorId: Number(command.actorId || 0),
    tenantId: Number(command.tenantId || 0),
    orgId: Number.isFinite(Number(command.orgId || 0)) && Number(command.orgId || 0) > 0 ? Number(command.orgId) : null,
    teamId: Number.isFinite(Number(command.teamId || 0)) && Number(command.teamId || 0) > 0 ? Number(command.teamId) : null,
    path: String(command.path || ''),
    source: String(command.source || 'web'),
    userAgent: String(command.userAgent || ''),
  });
};
