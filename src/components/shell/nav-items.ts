import type { LucideIcon } from "lucide-react";
import { Building2, Calendar, Clock, House, ListChecks, Plane, Users, Wallet } from "lucide-react";

export interface NavItem {
  href: string;
  /** Sidebar text, and the accessible name for the icon-only mobile tab. */
  label: string;
  /** Mobile tab bar only — the desktop sidebar stays text-only per the handoff. */
  icon: LucideIcon;
}

// Order matches the design handoff's five in-scope screens, with the
// remaining three routes folded in (they aren't modeled in the handoff's
// nav, but they still need to be reachable).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: House },
  { href: "/todo", label: "To-Do", icon: ListChecks },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/life-budget", label: "Life after", icon: Wallet },
  { href: "/honeymoon", label: "Honeymoon", icon: Plane },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/apartments", label: "Home", icon: Building2 },
  { href: "/wedding-day", label: "The day", icon: Clock },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
