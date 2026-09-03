import { ADDON_LABELS, FEATURE_LABELS } from "@/lib/entitlements";
import type { AddonKind, PlatformFeature } from "@/lib/entitlements";
import type { LaunchStatus, LaunchStatusRow } from "@/lib/launch-status.functions";

const STATUS_COPY: Record<LaunchStatus, { label: string; dot: string; text: string }> = {
  pending: {
    label: "Pending",
    dot: "bg-[oklch(0.75_0.16_65)] shadow-[0_0_10px_oklch(0.75_0.16_65_/_60%)]",
    text: "text-[oklch(0.82_0.13_70)]",
  },
  in_progress: {
    label: "In progress",
    dot: "bg-[oklch(0.78_0.15_85)] shadow-[0_0_10px_oklch(0.78_0.15_85_/_60%)]",
    text: "text-[oklch(0.85_0.12_88)]",
  },
  live: {
    label: "Live",
    dot: "bg-[oklch(0.78_0.16_150)] shadow-[0_0_10px_oklch(0.78_0.16_150_/_60%)]",
    text: "text-[oklch(0.84_0.13_155)]",
  },
};

export function StatusLight({ status }: { status: LaunchStatus }) {
  const s = STATUS_COPY[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${s.text}`}>
      <i className={`size-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      {s.label}
    </span>
  );
}

export function statusFor(rows: LaunchStatusRow[], key: string): LaunchStatus {
  return rows.find((r) => r.itemKey === key)?.status ?? "pending";
}

/**
 * What the client sees: every capability in their plan with the status ERA staff
 * set for it. No dates or delivery windows, the light is the single signal.
 */
export function LaunchStatusPanel({
  features,
  addons,
  rows,
}: {
  features: PlatformFeature[];
  addons: AddonKind[];
  rows: LaunchStatusRow[];
}) {
  const items = [
    ...features.map((f) => ({ key: f as string, label: FEATURE_LABELS[f] })),
    ...addons.map((a) => ({ key: a as string, label: ADDON_LABELS[a] })),
  ];
  if (items.length === 0) return null;

  const live = items.filter((i) => statusFor(rows, i.key) === "live").length;

  return (
    <section className="era-card p-6 sm:p-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Your system status
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each part of your build, updated by your ERA team as it goes live.
          </p>
        </div>
        <span className="era-chip shrink-0">
          {live} of {items.length} live
        </span>
      </div>

      <ul className="mt-5">
        {items.map((item) => (
          <li
            key={item.key}
            className="era-hairline grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3 last:border-b-0"
          >
            <span className="min-w-0 text-sm text-foreground">{item.label}</span>
            <StatusLight status={statusFor(rows, item.key)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
