import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/era-logo.png.asset.json";

export const NAV_LINKS = [
  { to: "/platform", label: "Platform" },
  { to: "/pricing", label: "Pricing" },
  { to: "/addons", label: "Add-ons" },
  { to: "/proof", label: "Proof" },
  { to: "/faq", label: "FAQ" },
] as const;

export function Logo({ className = "h-9" }: { className?: string }) {
  return <img src={logoAsset.url} alt="ERA Systems" className={`${className} w-auto`} />;
}

export function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 size-4 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${className}`}
    >
      {children}
    </div>
  );
}

export function CtaButton({
  children = "Book a discovery call",
  className = "",
  onClick,
}: {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to="/contact"
      onClick={onClick}
      className={
        className ||
        "rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-primary/90"
      }
    >
      {children}
    </Link>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" aria-label="ERA Systems home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CtaButton className="hidden rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-primary/90 sm:inline-flex" />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border/80 bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <CtaButton
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-md bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground"
            />
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/">
          <Logo className="h-8" />
        </Link>
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a href="mailto:support@eraleadgen.com" className="hover:text-foreground">
            support@eraleadgen.com
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} ERA Systems LLC
        </p>
      </div>
    </footer>
  );
}

/** Shared shell for every marketing page. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="dark site-gradient relative min-h-screen font-body text-foreground">
      <SiteBackdrop />
      <div className="relative z-10">
        <Header />
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}

/** Standard page intro used by the section pages. */
export function PageHero({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <section className="hero-veil border-b border-border">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">{eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">{lede}</p>
      </div>
    </section>
  );
}

/** Closing CTA band reused at the bottom of every section page. */
export function ClosingCta({
  title = "Ready to see it on your business?",
  body = "Every ERA account starts with a conversation. Tell us what you run today and we'll tell you plainly whether ERA fits.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-muted/30">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        <div className="mt-8 flex justify-center">
          <CtaButton />
        </div>
      </div>
    </section>
  );
}
