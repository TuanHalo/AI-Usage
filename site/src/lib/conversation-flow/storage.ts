import type { ConversationFlow, SavedFlowEntry } from './types';

const STORAGE_KEY = 'ai-usage:conversation-flows:v1';
const MAX_SAVED_FLOWS = 25;

function getSafeStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidSavedEntry(value: unknown): value is SavedFlowEntry {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.id !== 'string' || typeof value.savedAt !== 'string') {
    return false;
  }
  if (!isRecord(value.flow)) {
    return false;
  }
  return (
    value.flow.schemaVersion === '1.0' &&
    typeof value.flow.title === 'string' &&
    Array.isArray(value.flow.turns)
  );
}

export function loadSavedFlows(): readonly SavedFlowEntry[] {
  const storage = getSafeStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidSavedEntry);
  } catch {
    return [];
  }
}

export function saveFlowEntry(
  flow: ConversationFlow,
  existingId?: string
): readonly SavedFlowEntry[] {
  const storage = getSafeStorage();
  const current = loadSavedFlows();
  const id =
    existingId && existingId.trim().length > 0
      ? existingId
      : `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const nextEntry: SavedFlowEntry = {
    id,
    savedAt: new Date().toISOString(),
    flow,
  };

  const merged: SavedFlowEntry[] = [
    nextEntry,
    ...current.filter((item) => item.id !== id),
  ].slice(0, MAX_SAVED_FLOWS);

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      return current;
    }
  }

  return merged;
}

export function deleteFlowEntry(id: string): readonly SavedFlowEntry[] {
  const storage = getSafeStorage();
  const filtered = loadSavedFlows().filter((item) => item.id !== id);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      return filtered;
    }
  }
  return filtered;
}

export function clearAllSavedFlows(): void {
  const storage = getSafeStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}
