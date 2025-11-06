const DEFAULT_USER_KEY = 'default';

export function getUserStorageKey(userId?: string | null): string {
  if (!userId) return DEFAULT_USER_KEY;
  const trimmed = userId.trim();
  if (!trimmed) return DEFAULT_USER_KEY;
  return encodeURIComponent(trimmed);
}

export function getNamespacedKey(userKey: string, suffix: string): string {
  return `journal-${userKey}-${suffix}`;
}
