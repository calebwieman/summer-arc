/**
 * The small settings that are not habits and not days.
 *
 * They used to live as loose localStorage keys — the theme under one name, the
 * notification-prompt flag under another — which meant every restore silently
 * dropped them, because the backup only ever carried the habit registry and the
 * daily logs. Gathering them into one record makes them one thing the bundle
 * can carry, and gives `lastBackupAt` somewhere honest to live.
 */

const KEY = "standard:prefs:v1";

export interface Prefs {
  /** ISO timestamp of the last successful export, or undefined if never. */
  lastBackupAt?: string;
  /** Whether the notification prompt has been shown. Mirrors the old key. */
  notifAsked?: boolean;
  /** "system" | "light" | "dark", mirroring the theme provider. */
  theme?: string;
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Prefs;
  } catch {
    return {};
  }
}

export function setPrefs(patch: Prefs): Prefs {
  if (typeof window === "undefined") return {};
  const next = { ...getPrefs(), ...patch };
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Whole days since the last backup, or null when there has never been one. */
export function daysSinceBackup(now = new Date()): number | null {
  const at = getPrefs().lastBackupAt;
  if (!at) return null;
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 86400000));
}
