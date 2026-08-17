"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "standard:theme";

/**
 * Runs before paint in <head> so the correct tokens are stamped on the first
 * frame — no flash, and no dependence on React having hydrated.
 */
export const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem("${THEME_KEY}");var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

const SYSTEM_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * Stamp the resolved theme, suppressing transitions across the swap so
 * var()-driven endpoints are never animated from a value the incoming theme
 * will never re-resolve.
 */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute("data-theming", "");
  root.setAttribute("data-theme", resolved);
  // Lift the freeze once the swap has painted.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.removeAttribute("data-theming"));
  });
}

interface ThemeContextValue {
  /** What the user chose — may be "system". */
  pref: ThemePref;
  /** What is actually on screen. */
  resolved: ResolvedTheme;
  setTheme: (pref: ThemePref) => void;
  /** Whether the provider has synced with localStorage yet. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPref] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const [ready, setReady] = useState(false);

  // Adopt whatever the pre-paint script already decided.
  useEffect(() => {
    const stored = readPref();
    setPref(stored);
    setResolved(stored === "system" ? systemTheme() : stored);
    setReady(true);
  }, []);

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia(SYSTEM_QUERY);
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setTheme = useCallback((next: ThemePref) => {
    setPref(next);
    if (next === "system") {
      window.localStorage.removeItem(THEME_KEY);
    } else {
      window.localStorage.setItem(THEME_KEY, next);
    }
    const target = next === "system" ? systemTheme() : next;
    setResolved(target);
    applyTheme(target);
  }, []);

  return (
    <ThemeContext.Provider value={{ pref, resolved, setTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
