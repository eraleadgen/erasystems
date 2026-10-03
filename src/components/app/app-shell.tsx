import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/era-logo.png.asset.json";
import { brandVars, usePortalTheme } from "@/components/app/portal-theme";

export type NavItem = {
  label: string;
  to?: string;
  note?: string;
};

const CLIENT_NAV: NavItem[] = [
  { label: "Overview", to: "/dashboard" },
  { label: "Business information", to: "/business" },
  { label: "Catalog", note: "Coming with your plan" },
  { label: "Team", note: "Coming with your plan" },
  { label: "Billing", note: "Coming with your plan" },
];

const STAFF_NAV: NavItem[] = [
  { label: "Inbox", to: "/admin/inbox" },
  { label: "Clients", to: "/admin/clients" },
  { label: "Delivery", to: "/admin/delivery" },
  { label: "Calendar", to: "/admin/calendar" },
  { label: "Invitations", to: "/admin/invites" },
  { label: "Add-ons", to: "/admin/addons" },
  { label: "Documents", to: "/admin/documents" },
  { label: "Sales", to: "/admin/sales" },
  { label: "My dashboard", to: "/dashboard" },
  { label: "Marketing site", to: "/" },
];

export type ShellVariant = "client" | "staff";

function NavList({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {items.map((item) =>
        item.to ? (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: true }}
            activeProps={{ "data-active": "true" }}
            className="era-nav-link"
          >
            {item.label}
          </Link>
        ) : (
          <div key={item.label} className="era-nav-link era-nav-link--muted">
            <span>{item.label}</span>
            <span className="era-nav-note">{item.note}</span>
          </div>
        ),
      )}
    </nav>
  );
}

export function AppShell({
  title,
  status,
  role,
  variant = "client",
  navItems,
  children,
}: {
  title: string;
  status?: { label: string; tone: "live" | "waiting" | "halted" };
  role?: string;
  variant?: ShellVariant;
  /** Client tabs derived from the tenant's entitlements; falls back to defaults. */
  navItems?: NavItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = navItems ?? (variant === "staff" ? STAFF_NAV : CLIENT_NAV);
  const theme = usePortalTheme(variant === "client");
  const look = variant === "client" ? theme.data : null;


  return (
    <div
      className={`era-app min-h-screen bg-background text-foreground ${look?.theme === "light" ? "era-light" : ""}`}
      style={brandVars(look?.brandPrimary)}
    >
      <div className="mx-auto flex w-full max-w-[92rem]">
        <aside className="era-rail hidden w-64 shrink-0 flex-col px-5 py-7 lg:flex">
          <Link to={variant === "staff" ? "/admin/invites" : "/dashboard"} className="flex items-center gap-3">
            <img src={logoAsset.url} alt="ERA Systems" className="h-9 w-auto" />
          </Link>
          {variant === "staff" ? (
            <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Agency console</p>
          ) : (
            <p className="era-member-glow mt-2 text-[11px] font-semibold uppercase tracking-[0.28em]">ERA Member</p>
          )}
          {look?.logoUrl ? (
            <img src={look.logoUrl} alt="Business logo" className="mt-5 h-12 w-auto max-w-full object-contain" />
          ) : null}
          <div className="mt-8 flex-1">
            <NavList items={items} />
          </div>
          {variant === "staff" ? (
            <p className="era-hairline pt-4 text-xs text-muted-foreground">
              ERA Systems LLC, agency operations.
            </p>
          ) : (
            <div className="era-hairline space-y-2 pt-4">
              <p className="text-xs text-muted-foreground">
                Need a change? Your ERA representative can help.
              </p>
              <a
                href="mailto:support@eraleadgen.com"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Contact support
              </a>
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <header className="era-topbar sticky top-0 z-20 flex items-center gap-3 px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
              className="era-icon-button lg:hidden"
            >
              <span className="era-burger" />
            </button>
            <img src={logoAsset.url} alt="" className="hidden h-7 w-auto sm:block lg:hidden" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold leading-snug tracking-tight text-foreground [overflow-wrap:anywhere] sm:truncate sm:text-base">
                {title}
              </h1>
            </div>
            {role && <span className="era-chip hidden sm:inline-flex">{role}</span>}
            {status && (
              <span
                className={`era-status era-status--${status.tone} shrink-0`}
                title={status.label}
                aria-label={status.label}
              >
                <i />
                <span className="hidden sm:inline">{status.label}</span>
              </span>
            )}
          </header>

          {open && (
            <div className="era-hairline border-b px-5 py-3 lg:hidden">
              <NavList items={items} onNavigate={() => setOpen(false)} />
            </div>
          )}

          <main className="px-5 py-7 sm:px-8 sm:py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
