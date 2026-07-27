"use client";

import { useEffect, useState, type ReactNode } from "react";
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

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  };

  return (
    <HeaderProvider>
      <div className="font-apple flex min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        <Sidebar pathname={pathname} theme={theme} onToggleTheme={toggleTheme} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ScreenHeader pathname={pathname} theme={theme} onToggleTheme={toggleTheme} />
          <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 pt-[22px] pb-[120px] sm:px-6 md:px-10">
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
        "sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--sep)] px-4 py-3 sm:px-6 md:px-10",
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
        "fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-[var(--sep)] px-1 pt-[9px] pb-[calc(9px+env(safe-area-inset-bottom))] lg:hidden",
        NAV_MATERIAL
      )}
    >
      {NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 px-3 py-1.5 text-[12px] whitespace-nowrap tracking-[-0.005em] transition-colors",
              active ? "font-[600] text-[var(--accent)]" : "font-[450] text-[var(--fg2)]"
            )}
          >
            {item.short}
          </Link>
        );
      })}
    </nav>
  );
}
