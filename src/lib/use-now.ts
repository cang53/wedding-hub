"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, rounded down to the minute, refreshed every minute.
 *
 * The clock is an external store rather than a `Date.now()` call in the
 * render body: reading a moving global during render makes the component
 * impure (two renders with identical props can disagree), which is what
 * react-hooks/purity flags.
 *
 * One interval is shared by every subscriber, and it only runs while
 * something is mounted.
 */
const TICK_MS = 60_000;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  timer ??= setInterval(() => {
    for (const listener of listeners) listener();
  }, TICK_MS);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

// Quantised so repeated reads within a minute return an identical value —
// useSyncExternalStore re-renders in a loop if getSnapshot keeps changing.
function getSnapshot(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
