function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))).sort();
}

export function toggleActivitySelection(selectedIds: string[], id: string): string[] {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) return normalizeIds(selectedIds);
  const selectedSet = new Set(normalizeIds(selectedIds));
  if (selectedSet.has(normalizedId)) {
    selectedSet.delete(normalizedId);
  } else {
    selectedSet.add(normalizedId);
  }
  return Array.from(selectedSet).sort();
}

export function togglePageActivitySelection(selectedIds: string[], pageIds: string[]): string[] {
  const normalizedSelected = new Set(normalizeIds(selectedIds));
  const normalizedPageIds = normalizeIds(pageIds);
  if (normalizedPageIds.length === 0) return Array.from(normalizedSelected).sort();

  const hasEveryPageId = normalizedPageIds.every((id) => normalizedSelected.has(id));
  if (hasEveryPageId) {
    normalizedPageIds.forEach((id) => normalizedSelected.delete(id));
  } else {
    normalizedPageIds.forEach((id) => normalizedSelected.add(id));
  }

  return Array.from(normalizedSelected).sort();
}

export function pruneActivitySelection(selectedIds: string[], availableIds: string[]): string[] {
  const availableIdSet = new Set(normalizeIds(availableIds));
  return normalizeIds(selectedIds).filter((id) => availableIdSet.has(id));
}
