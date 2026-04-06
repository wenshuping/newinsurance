import { normalizeRunningStatus, type RunningStatus } from '../../../shared-contracts/template-status';
import { ACTION_COPY } from './uiCopy';

export type VisibleStatus = RunningStatus;

export function toVisibleStatus(value: unknown): VisibleStatus {
  return normalizeRunningStatus(String(value || ''));
}

export function visibleStatusLabel(value: unknown) {
  const s = toVisibleStatus(value);
  if (s === 'draft') return ACTION_COPY.cStatusDraft;
  if (s === 'inactive') return ACTION_COPY.cStatusOffline;
  return ACTION_COPY.cStatusRunning;
}

export function visibleStatusClass(value: unknown) {
  const s = toVisibleStatus(value);
  if (s === 'draft') return 'bg-slate-500';
  if (s === 'inactive') return 'bg-rose-500';
  return 'bg-blue-500';
}
