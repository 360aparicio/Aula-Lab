/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UserStorage: Aislamiento estricto por UID en localStorage (con fallback en memoria para Node/tests).
 * Garantiza que cada usuario autenticado tenga su propio ELO, historial de preguntas vistas,
 * mazo SuperMemo SM-2, fugas detectadas, estadísticas por categoría y plan de carrera sin mezclas.
 */

let activeUid = 'guest';
const memoryStore = new Map<string, string>();
const LEGACY_OWNER_KEY = 'lab_studio_legacy_owner_uid';

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage !== null;
  } catch {
    return false;
  }
}

function getRaw(key: string): string | null {
  if (hasLocalStorage()) {
    try {
      return localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

function setRaw(key: string, value: string): void {
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // fallback to memory store
    }
  }
  memoryStore.set(key, value);
}

function removeRaw(key: string): void {
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  memoryStore.delete(key);
}

export function setActiveStorageUserUid(uid: string | null | undefined): string {
  const cleaned = typeof uid === 'string' && uid.trim().length > 0 ? uid.trim() : 'guest';
  activeUid = cleaned;
  return activeUid;
}

export function getActiveStorageUserUid(): string {
  return activeUid;
}

export function getScopedStorageKey(baseKey: string, uidOverride?: string): string {
  const scope = uidOverride && uidOverride.trim().length > 0 ? uidOverride.trim() : activeUid;
  return `${baseKey}__u_${scope}`;
}

export function readScopedItem(baseKey: string): string | null {
  const scopedKey = getScopedStorageKey(baseKey);
  const existing = getRaw(scopedKey);
  if (existing !== null) return existing;

  // Migrate un-scoped legacy key at most once for the very first signed-in owner on this browser
  if (activeUid !== 'guest') {
    const legacyOwner = getRaw(LEGACY_OWNER_KEY);
    if (!legacyOwner || legacyOwner === activeUid) {
      const legacyVal = getRaw(baseKey);
      if (legacyVal !== null) {
        setRaw(LEGACY_OWNER_KEY, activeUid);
        setRaw(scopedKey, legacyVal);
        return legacyVal;
      }
    }
  }

  return null;
}

export function writeScopedItem(baseKey: string, value: string): void {
  const scopedKey = getScopedStorageKey(baseKey);
  setRaw(scopedKey, value);
  if (activeUid !== 'guest' && !getRaw(LEGACY_OWNER_KEY)) {
    setRaw(LEGACY_OWNER_KEY, activeUid);
  }
}

export function removeScopedItem(baseKey: string): void {
  removeRaw(getScopedStorageKey(baseKey));
}

export function readScopedJson<T>(baseKey: string, fallback: T): T {
  try {
    const raw = readScopedItem(baseKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeScopedJson(baseKey: string, value: unknown): void {
  try {
    writeScopedItem(baseKey, JSON.stringify(value));
  } catch {
    // ignore serialization/storage quota errors
  }
}

export function clearMemoryUserStorage(): void {
  memoryStore.clear();
}
