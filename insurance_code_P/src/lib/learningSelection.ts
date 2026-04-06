function normalizeIds(ids: number[]): number[] {
  return Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))).sort((a, b) => a - b);
}

export function toggleLearningSelection(selectedIds: number[], id: number): number[] {
  const normalizedId = Number(id);
  if (!Number.isInteger(normalizedId) || normalizedId <= 0) return normalizeIds(selectedIds);
  const selectedSet = new Set(normalizeIds(selectedIds));
  if (selectedSet.has(normalizedId)) {
    selectedSet.delete(normalizedId);
  } else {
    selectedSet.add(normalizedId);
  }
  return Array.from(selectedSet).sort((a, b) => a - b);
}

export function togglePageLearningSelection(selectedIds: number[], pageIds: number[]): number[] {
  const normalizedSelected = new Set(normalizeIds(selectedIds));
  const normalizedPageIds = normalizeIds(pageIds);
  if (normalizedPageIds.length === 0) return Array.from(normalizedSelected).sort((a, b) => a - b);

  const hasEveryPageId = normalizedPageIds.every((id) => normalizedSelected.has(id));
  if (hasEveryPageId) {
    normalizedPageIds.forEach((id) => normalizedSelected.delete(id));
  } else {
    normalizedPageIds.forEach((id) => normalizedSelected.add(id));
  }

  return Array.from(normalizedSelected).sort((a, b) => a - b);
}

export function pruneLearningSelection(selectedIds: number[], availableIds: number[]): number[] {
  const availableIdSet = new Set(normalizeIds(availableIds));
  return normalizeIds(selectedIds).filter((id) => availableIdSet.has(id));
}
