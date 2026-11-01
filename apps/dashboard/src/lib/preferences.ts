// Preferences are optional: browser storage denial must not interrupt the workspace.
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function savePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep the current in-memory selection when persistence is unavailable.
  }
}
