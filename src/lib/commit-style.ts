"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getPrefs, setPrefs } from "./prefs";

/**
 * How a habit gets committed.
 *
 * The drag was the original answer — deliberate, physical, hard to fire by
 * accident. It became clunky once the whole app went swipe-driven: a horizontal
 * drag inside the content now competes with the gesture that moves between
 * surfaces, on top of asking for most of the track's width. Rather than guess a
 * replacement, all three live here and the choice is yours.
 */
export type CommitStyle = "hold" | "tap" | "throw";

export const COMMIT_STYLES: { value: CommitStyle; label: string; hint: string }[] = [
  { value: "hold", label: "Hold", hint: "press and hold — no swipe to fight" },
  { value: "tap", label: "Tap", hint: "one tap, undo for a few seconds" },
  { value: "throw", label: "Throw", hint: "a short flick across the track" },
];

export const DEFAULT_COMMIT_STYLE: CommitStyle = "hold";

const EVENT = "standard:commit-style";

function read(): CommitStyle {
  const v = getPrefs().commitStyle;
  return v === "hold" || v === "tap" || v === "throw" ? v : DEFAULT_COMMIT_STYLE;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  // Another tab (or the settings sheet in a second window) writing prefs.
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Every Latch on screen re-renders the moment the preference changes, without
 * threading a prop through three unrelated call sites (the day block, the
 * floating sheet and the history day sheet all mount their own).
 */
export function useCommitStyle(): [CommitStyle, (next: CommitStyle) => void] {
  const style = useSyncExternalStore(subscribe, read, () => DEFAULT_COMMIT_STYLE);
  const set = useCallback((next: CommitStyle) => {
    setPrefs({ commitStyle: next });
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [style, set];
}
