export interface NavItem {
  href: string;
  label: string;
  short: string;
}

// Order matches the design handoff's five in-scope screens, with the
// remaining three routes folded in (they aren't modeled in the handoff's
// nav, but they still need to be reachable).
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", short: "Overview" },
  { href: "/todo", label: "To-Do", short: "To-Do" },
  { href: "/agenda", label: "Agenda", short: "Agenda" },
  { href: "/life-budget", label: "Life after", short: "Life" },
  { href: "/honeymoon", label: "Honeymoon", short: "Trip" },
  { href: "/guests", label: "Guests", short: "Guests" },
  { href: "/apartments", label: "Home", short: "Home" },
  { href: "/wedding-day", label: "The day", short: "Day" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
