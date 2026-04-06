export function resolveBatchDeleteAction({
  isSelecting,
  selectedCount,
}: {
  isSelecting: boolean;
  selectedCount: number;
}): 'enter-select' | 'confirm-delete' | 'idle-select' {
  if (!isSelecting) return 'enter-select';
  if (selectedCount > 0) return 'confirm-delete';
  return 'idle-select';
}

export function buildBatchDeleteResultMessage({
  deletedCount,
  failedCount,
  unit,
}: {
  deletedCount: number;
  failedCount: number;
  unit: string;
}): string {
  if (failedCount > 0) {
    return `已删除 ${deletedCount} ${unit}，另有 ${failedCount} ${unit}删除失败，请重试。`;
  }
  return `已删除 ${deletedCount} ${unit}。`;
}
