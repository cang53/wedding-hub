"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = { href: string; label: string; icon: string };

// Order matches the prototype. Icons are unicode glyphs straight from the
// prototype's <span class="icon"> markup — keeps the editorial feel without
// pulling in an icon library for the nav.
const TABS: Tab[] = [
  { href: "/dashboard",  label: "Overview",  icon: "◆" },
  { href: "/todo",       label: "To-Do",     icon: "✓" },
  { href: "/agenda",     label: "Agenda",    icon: "❦" },
  { href: "/budget",     label: "Budget",    icon: "€" },
  { href: "/honeymoon",  label: "Honeymoon", icon: "✈" },
  { href: "/guests",     label: "Guests",    icon: "♥" },
  { href: "/apartments", label: "Home",      icon: "⌂" },
  { href: "/wedding-day", label: "Day",      icon: "⌚" },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap justify-center gap-1 mb-10 p-1.5 bg-paper border border-line rounded-full shadow-soft max-md:rounded-[4px]"
      role="tablist"
    >
      {TABS.map((tab) => {
        // Active when path is exactly tab.href OR a sub-route of it.
        const active =
          pathname === tab.href ||
          (tab.href !== "/dashboard" && pathname.startsWith(tab.href + "/"));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium tracking-[0.02em] transition-all duration-200 max-md:px-3 max-md:py-2 max-md:text-xs",
              active
                ? "bg-ink text-cream"
                : "text-ink-soft hover:text-ink hover:bg-cream-deep"
            )}
          >
            <span className="text-[14px]" aria-hidden>{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
