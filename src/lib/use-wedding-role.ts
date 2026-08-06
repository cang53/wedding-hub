"use client";

import { useSyncExternalStore } from "react";

export type WeddingRole = "bride" | "groom";

export const ROLE_STORAGE_KEY = "wedding-role";

/**
 * The role the visitor picked on the landing page, read from localStorage.
 *
 * localStorage is an external store, so it's read through
 * useSyncExternalStore rather than an effect that calls setState — the
 * latter costs a second render pass on every mount and trips
 * react-hooks/set-state-in-effect.
 *
 * Returns null during server rendering and on the first client pass for
 * visitors who never picked a role, so callers should treat null as
 * "no role chosen".
 */
function subscribe(onStoreChange: () => void) {
  // Only fires for changes made in *other* tabs; same-tab writes navigate
  // away and remount, which re-reads the snapshot anyway.
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): WeddingRole | null {
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return stored === "bride" || stored === "groom" ? stored : null;
}

function getServerSnapshot(): WeddingRole | null {
  return null;
}

export function useWeddingRole(): WeddingRole | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
