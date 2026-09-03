import {
  ADDON_DELIVERY,
  FEATURE_DELIVERY,
  MAX_DELIVERY_DAYS,
  estimatedDate,
  groupByWindow,
  type DeliveryWindow,
} from "@/lib/delivery-timeline";
import { ADDON_LABELS, FEATURE_LABELS } from "@/lib/entitlements";
import type { AddonKind, PlatformFeature } from "@/lib/entitlements";

/**
 * "When does each part of my system go live?" — shown from the moment the
 * account exists. Windows start at kickoff (payment); before that the dates are
 * shown as relative windows only, so nothing implies work has already begun.
 */
export function DeliveryTimeline({
  features,
  addons,
  startedAt,
}: {
  features: PlatformFeature[];
  addons: AddonKind[];
  /** Kickoff timestamp, or null while the business is still awaiting payment. */
  startedAt: string | null;
}) {
  const items: { key: string; label: string; window: DeliveryWindow }[] = [
    ...features.map((f) => ({ key: f, label: FEATURE_LABELS[f], window: FEATURE_DELIVERY[f] })),
    ...addons.map((a) => ({ key: a, label: ADDON_LABELS[a], window: ADDON_DELIVERY[a] })),
  ];

  if (items.length === 0) return null;
  const groups = groupByWindow(items);
  const fullyLiveOn = estimatedDate(startedAt, MAX_DELIVERY_DAYS);

  return (
    <section className="era-card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            When your system goes live
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {startedAt
              ? "Build windows for everything included in your plan, counted from kickoff."
              : "Build windows for everything included in your plan. The clock starts once payment completes."}
          </p>
        </div>
        <div className="era-hairline rounded-lg border px-4 py-3 sm:text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Fully live within
          </p>
          <p className="text-sm font-semibold text-foreground">{MAX_DELIVERY_DAYS} days</p>
          {fullyLiveOn && (
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              by {fullyLiveOn}
            </p>
          )}
        </div>
      </div>

      <ol className="mt-6 space-y-0">
        {groups.map((group) => {
          const date = estimatedDate(startedAt, group.window.days);
          return (
            <li
              key={group.window.label}
              className="era-hairline flex flex-col gap-2 border-b py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <div className="sm:max-w-[62%]">
                <p className="text-sm text-foreground">{group.labels.join(", ")}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-medium text-foreground">{group.window.label}</p>
                {date && (
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    around {date}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-muted-foreground">
        Every feature in your plan is live within 7 days of kickoff. Windows assume we have what we need from you. Anything waiting on your domain, content or
        approvals starts when that arrives.
      </p>
    </section>
  );
}
