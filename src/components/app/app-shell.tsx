import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/era-logo.png.asset.json";

export type NavItem = {
  label: string;
  to?: string;
  note?: string;
};

const NAV: NavItem[] = [
  { label: "Overview", to: "/dashboard" },
  { label: "Business setup", to: "/onboarding" },
  { label: "Catalog", note: "Coming with your plan" },
  { label: "Team", note: "Coming with your plan" },
  { label: "Billing", note: "Coming with your plan" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map((item) =>
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
  children,
}: {
  title: string;
  status?: { label: string; tone: "live" | "waiting" | "halted" };
  role?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="era-app min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[92rem]">
        <aside className="era-rail hidden w-64 shrink-0 flex-col px-5 py-7 lg:flex">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={logoAsset.url} alt="ERA Systems" className="h-9 w-auto" />
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Client portal
          </p>
          <div className="mt-8 flex-1">
            <NavList />
          </div>
          <p className="era-hairline pt-4 text-xs text-muted-foreground">
            Need a change? Your ERA representative can help.
          </p>
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
            <img src={logoAsset.url} alt="" className="h-7 w-auto lg:hidden" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            {role && <span className="era-chip hidden sm:inline-flex">{role}</span>}
            {status && (
              <span className={`era-status era-status--${status.tone}`}>
                <i />
                {status.label}
              </span>
            )}
          </header>

          {open && (
            <div className="era-hairline border-b px-5 py-3 lg:hidden">
              <NavList onNavigate={() => setOpen(false)} />
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
