/**
 * User Storage Utilities
 * 
 * Helper functions for managing namespaced localStorage keys.
 */

/**
 * Generates a unique storage key for a user
 */
export function getUserStorageKey(userId: string): string {
    // Simple sanitization to ensure safe key characters
    const safeId = userId.replace(/[^a-zA-Z0-9-_]/g, '');
    return `user-${safeId}`;
}

/**
 * Generates a namespaced key for a specific resource
 * Format: journal-{userKey}--{suffix}
 */
export function getNamespacedKey(userKey: string, suffix: string): string {
    return `journal-${userKey}--${suffix}`;
}
