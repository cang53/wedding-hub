"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface HeaderAction {
  actionLabel?: string;
  onAction?: () => void;
}

const HeaderStateContext = createContext<HeaderAction>({});
const HeaderSetterContext = createContext<(action: HeaderAction) => void>(() => {});

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderAction>({});
  return (
    <HeaderSetterContext.Provider value={setAction}>
      <HeaderStateContext.Provider value={action}>{children}</HeaderStateContext.Provider>
    </HeaderSetterContext.Provider>
  );
}

export function useHeaderAction() {
  return useContext(HeaderStateContext);
}

/**
 * A screen calls this to publish its primary action (the borderless accent
 * button in the shared sticky header) — e.g. usePageHeader("Add guest", openDialog).
 * The header's title comes from the route, not from here, so it never flashes blank.
 */
export function usePageHeader(actionLabel?: string, onAction?: () => void) {
  const setAction = useContext(HeaderSetterContext);
  const onActionRef = useRef(onAction);

  // Refs are only safe to write outside of render — keep the latest
  // closure here so the effect below doesn't need onAction as a dependency
  // (a new function identity every render would otherwise re-fire it).
  useEffect(() => {
    onActionRef.current = onAction;
  });

  useEffect(() => {
    if (!actionLabel) {
      setAction({});
      return;
    }
    setAction({ actionLabel, onAction: () => onActionRef.current?.() });
    return () => setAction({});
  }, [setAction, actionLabel]);
}
