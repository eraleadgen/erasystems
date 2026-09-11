import type { AppIdentity } from "./app-identity.server";

/**
 * One shared shape for both installable apps, so a business's two icons are
 * consistently branded and clearly distinguishable on a home screen.
 */
export type AppKind = "customer" | "team";

export function buildManifest(identity: AppIdentity, kind: AppKind) {
  const isTeam = kind === "team";
  const base = `/app-icon/${identity.businessId}`;
  return {
    id: isTeam ? `/dashboard?app=${identity.slug}` : `/?app=${identity.slug}`,
    name: isTeam ? `${identity.name} Team` : identity.name,
    short_name: isTeam ? `${shorten(identity.name)} Team` : shorten(identity.name),
    description: isTeam
      ? `Manage ${identity.name}: bookings, customers and your team.`
      : `Book with ${identity.name}.`,
    start_url: isTeam ? "/dashboard" : "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: identity.brandPrimary,
    background_color: identity.brandAccent || identity.brandPrimary,
    icons: [
      { src: `${base}/any.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

function shorten(name: string) {
  return name.length <= 12 ? name : `${name.slice(0, 11).trim()}…`;
}
