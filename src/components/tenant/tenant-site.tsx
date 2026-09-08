import type { ResolvedTenant } from "@/lib/tenant.functions";
import type { TenantService } from "@/components/tenant-home";
import {
  fallbackAbout,
  fallbackTagline,
  formatAddress,
  hasHours,
  hoursRows,
  type TenantSiteContent,
} from "@/lib/tenant-site";
import { TenantBookingForm } from "@/components/tenant/booking-form";
import { TenantChatWidget } from "@/components/tenant/chat-widget";

/**
 * The generic public website every tenant gets.
 *
 * Everything on this page comes from that one business: its name, logo, brand
 * colors, catalog, hours, address and contact details. No ERA content, no
 * other tenant's content, and no per-client code.
 */

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function TenantSite({
  tenant,
  services,
  site,
}: {
  tenant: ResolvedTenant;
  services: TenantService[];
  site: TenantSiteContent;
}) {
  const primary = tenant.brandPrimary || "#0f766e";
  const accent = tenant.brandAccent || primary;
  const serviceNames = services.map((s) => s.name);
  const tagline = site.tagline || fallbackTagline(tenant.name, serviceNames);
  const about = site.about || fallbackAbout(tenant.name, serviceNames, site.serviceArea);
  const address = formatAddress(site);
  const rows = hoursRows(site.hours);
  const showBooking = site.bookingEnabled && services.length > 0;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ ["--tenant-primary" as string]: primary, ["--tenant-accent" as string]: accent }}
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-9 w-auto" />
            ) : (
              <span
                className="inline-flex size-9 items-center justify-center rounded-md text-sm font-bold text-white"
                style={{ backgroundColor: primary }}
                aria-hidden
              >
                {tenant.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-base font-semibold tracking-tight">{tenant.name}</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-sm">
            <a href="#services" className="text-muted-foreground hover:text-foreground">
              Services
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground">
              About
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground">
              Contact
            </a>
            {showBooking && (
              <a
                href="#book"
                className="rounded-md px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Book now
              </a>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 pt-4">
        <InstallApp kind="customer" />
      </div>


      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-20 lg:text-left">
          {site.serviceArea && (
            <p
              className="text-xs font-semibold uppercase tracking-[0.28em]"
              style={{ color: accent }}
            >
              {site.serviceArea}
            </p>
          )}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{tenant.name}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground lg:mx-0">
            {tagline}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            {showBooking && (
              <a
                href="#book"
                className="rounded-md px-6 py-3 text-sm font-semibold text-white"
                style={{ backgroundColor: primary }}
              >
                Book online
              </a>
            )}
            {tenant.supportPhone && (
              <a
                href={`tel:${tenant.supportPhone.replace(/[^\d+]/g, "")}`}
                className="rounded-md border border-border px-6 py-3 text-sm font-semibold"
              >
                Call {tenant.supportPhone}
              </a>
            )}
          </div>
        </div>
      </section>

      {services.length > 0 && (
        <section id="services" className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">Services &amp; pricing</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <li key={service.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-base font-semibold">{service.name}</h3>
                  <span className="shrink-0 text-base font-semibold" style={{ color: primary }}>
                    {money(service.base_price_cents)}
                  </span>
                </div>
                {service.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                )}
                <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">
                  {service.duration_minutes} minutes
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="about" className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">About {tenant.name}</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {about}
            </p>
          </div>
          {hasHours(site.hours) && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Opening hours
              </h3>
              <dl className="mt-4 divide-y divide-border rounded-lg border border-border">
                {rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-sm text-muted-foreground">{row.label}</dt>
                    <dd className="text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </section>

      {showBooking && (
        <section id="book" className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Book an appointment</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick your services and a time that suits you. We&apos;ll confirm by phone or email.
          </p>
          <div className="mt-6">
            <TenantBookingForm
              businessId={tenant.businessId}
              services={services}
              requireAddress={site.serviceLocation === "at_customer"}
              accent={primary}
            />
          </div>
        </section>
      )}

      <footer id="contact" className="border-t border-border">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-12 sm:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold">{tenant.name}</h3>
            {address && <p className="mt-2 text-sm text-muted-foreground">{address}</p>}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Get in touch</h3>
            {tenant.supportPhone && (
              <p className="mt-2 text-sm text-muted-foreground">{tenant.supportPhone}</p>
            )}
            {tenant.supportEmail && (
              <p className="text-sm text-muted-foreground">{tenant.supportEmail}</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Hours</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {rows.length > 0 ? rows.map((r) => `${r.label}: ${r.value}`).join(" · ") : "By appointment"}
            </p>
          </div>
        </div>
        <div className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {tenant.name}. All rights reserved.
        </div>
      </footer>

      <TenantChatWidget
        businessId={tenant.businessId}
        businessName={tenant.name}
        primary={primary}
        accent={accent}
      />
    </div>
  );
}
