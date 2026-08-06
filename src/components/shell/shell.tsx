"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { WEDDING_DATE } from "@/lib/config";
import { RoleSelector } from "@/components/role-selector";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
import { HeaderProvider, useHeaderAction } from "./header-context";
import { AppearanceSwitch } from "./appearance-switch";

const WEDDING_DATE_LONG = new Date(WEDDING_DATE).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const THEME_STORAGE_KEY = "wedding-hub-theme";

// Theme lives in localStorage, an external store, so it's read through
// useSyncExternalStore rather than a mount effect that calls setState —
// the latter costs a second render pass and trips react-hooks/set-state-in-effect.
const themeListeners = new Set<() => void>();

function subscribeTheme(onStoreChange: () => void) {
  themeListeners.add(onStoreChange);
  return () => themeListeners.delete(onStoreChange);
}

function getThemeSnapshot(): "light" | "dark" {
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function getThemeServerSnapshot(): "light" | "dark" {
  return "light";
}

function applyTheme(next: "light" | "dark") {
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  for (const listener of themeListeners) listener();
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  // Sync the DOM attribute the CSS reads to the resolved theme — a genuine
  // external-system update, not a state signal, so it belongs in an effect.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <HeaderProvider>
      <div className="font-apple flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <Sidebar pathname={pathname} theme={theme} onToggleTheme={toggleTheme} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ScreenHeader pathname={pathname} theme={theme} onToggleTheme={toggleTheme} />
          {/* Bottom padding clears the fixed tab bar (which now grows by the
              home-indicator inset) plus breathing room under the last row. */}
          <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 pt-[22px] pb-[calc(120px+env(safe-area-inset-bottom))] sm:px-6 md:px-10">
            {children}
          </main>
        </div>
        <BottomNav pathname={pathname} />
      </div>
    </HeaderProvider>
  );
}

const NAV_MATERIAL =
  "bg-[var(--nav)] backdrop-blur-[22px] [-webkit-backdrop-filter:saturate(180%)_blur(22px)] backdrop-saturate-[180%]";

function Sidebar({
  pathname, theme, onToggleTheme,
}: {
  pathname: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen w-[236px] flex-none flex-col gap-6 border-r border-[var(--sep)] p-3 lg:flex",
        NAV_MATERIAL
      )}
    >
      <div className="px-2.5 pt-1">
        <div className="text-[17px] font-semibold tracking-[-0.02em]">Celal &amp; Selver</div>
        <div className="mt-0.5 text-[13px] text-[var(--fg2)]">{WEDDING_DATE_LONG}</div>
      </div>

      <nav className="flex flex-col gap-px">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-[8px] px-2.5 py-2 text-[15px] tracking-[-0.014em] transition-colors hover:bg-[var(--fill)]",
                active ? "bg-[var(--fill)] font-[590] text-[var(--accent)]" : "font-[440] text-[var(--fg)]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <RoleSelector />
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-[13px] text-[var(--fg2)]">Dark</span>
          <AppearanceSwitch theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </aside>
  );
}

function ScreenHeader({
  pathname, theme, onToggleTheme,
}: {
  pathname: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const title = NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href))?.label ?? "";
  const { actionLabel, onAction } = useHeaderAction();

  return (
    <header
      className={cn(
        // viewport-fit=cover lets the page run under the status bar / notch,
        // so the header has to pay back the top inset itself.
        "sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--sep)] px-4 pb-3 sm:px-6 md:px-10",
        "pt-[calc(12px+env(safe-area-inset-top))]",
        NAV_MATERIAL
      )}
    >
      <h1 className="m-0 text-[clamp(26px,3.4vw,34px)] leading-[1.1] font-bold tracking-[-0.026em]">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="lg:hidden">
          <AppearanceSwitch theme={theme} onToggle={onToggleTheme} />
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="border-none bg-transparent p-0 text-[16px] whitespace-nowrap text-[var(--accent)] transition-opacity hover:opacity-60"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className={cn(
        // Icon-only, so all eight fit without horizontal scrolling.
        // Bottom padding takes whichever is larger: a flat 18px, or enough to
        // clear the home indicator. max() rather than a sum, so devices that
        // report no inset (Android, older iPhones) still get real clearance
        // and notched iPhones don't end up with a needlessly deep bar.
        "fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-0.5 border-t border-[var(--sep)] pt-1.5 lg:hidden",
        "pb-[max(18px,calc(6px+env(safe-area-inset-bottom)))]",
        "pl-[max(8px,env(safe-area-inset-left))] pr-[max(8px,env(safe-area-inset-right))]",
        NAV_MATERIAL
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            title={item.label}
            // min-h-11 == 44px, Apple's minimum comfortable tap target.
            className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] transition-colors active:bg-[var(--fill)]"
            style={{ color: active ? "var(--accent)" : "var(--fg2)" }}
          >
            <Icon size={23} strokeWidth={active ? 2.1 : 1.6} aria-hidden />
          </Link>
        );
      })}
    </nav>
  );
}
