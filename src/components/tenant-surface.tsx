import { Link } from "@tanstack/react-router";

import logoAsset from "@/assets/era-logo.png.asset.json";
import type { ResolvedTenant } from "@/lib/tenant.functions";

/**
 * Shared presentation for tenant-facing surfaces (customer and specialist
 * portals). Uses the same ERA app palette as the client dashboard so every
 * signed-in surface reads as one product.
 */
export function TenantSurface({
  kicker,
  title,
  body,
  feature,
  tenant,
  allowed,
}: {
  kicker: string;
  title: string;
  body: string;
  feature: string;
  tenant: ResolvedTenant | null;
  allowed: boolean;
}) {
  return (
    <div className="era-app min-h-screen bg-background text-foreground">
      <header className="era-topbar flex items-center gap-3 px-5 py-4 sm:px-8">
        {/* On a client's own domain, never show ERA's mark or link back to ERA. */}
        {tenant ? (
          <Link to="/" className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-7 w-auto" />
            ) : (
              <span className="text-sm font-semibold text-foreground">{tenant.name}</span>
            )}
          </Link>
        ) : (
          <Link to="/">
            <img src={logoAsset.url} alt="ERA Systems" className="h-7 w-auto" />
          </Link>
        )}
        <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
          {kicker}
        </span>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>

        {!tenant ? (
          <div className="era-card mt-6 p-6">
            <p className="text-sm text-muted-foreground">
              This address isn&apos;t mapped to a business yet. Tenant surfaces render on a
              client&apos;s own domain, resolved server side before anything is shown.
            </p>
            <Link
              to="/"
              className="mt-5 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to eraleadgen.com
            </Link>
          </div>
        ) : !allowed ? (

          <div className="era-card mt-6 p-6">
            <p className="text-sm text-muted-foreground">
              This business&apos;s plan doesn&apos;t include{" "}
              <code className="text-foreground">{feature}</code>. Add-ons and tier changes are
              arranged with an ERA representative.
            </p>
          </div>
        ) : (
          <div className="era-card mt-6 p-6">
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        )}
      </main>
    </div>
  );
}
