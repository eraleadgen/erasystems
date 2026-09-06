import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { buildClientNav } from "@/components/app/client-nav";
import { getMyPortalContext } from "@/lib/portal.functions";
import { SiteContentEditor } from "@/components/app/site-content-editor";
import {
  getMyBusinessProfile,
  updateMyBusinessProfile,
  type BusinessProfile,
} from "@/lib/business-profile.functions";

export const Route = createFileRoute("/_authenticated/business")({
  head: () => ({
    meta: [
      { title: "Business information | ERA App" },
      {
        name: "description",
        content:
          "View and update the business details ERA uses across your website, bookings and communications.",
      },
      { property: "og:title", content: "Business information | ERA App" },
      {
        property: "og:description",
        content: "Keep your ERA business details current across the whole system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BusinessInfoPage,
  errorComponent: ({ error }) => (
    <AppShell title="Business information">
      <div className="era-card p-6">
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Business information">
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">Nothing here.</p>
      </div>
    </AppShell>
  ),
});

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

function Labelled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">{text}</span>
      {children}
    </label>
  );
}

type Form = {
  name: string;
  legalName: string;
  timezone: string;
  supportEmail: string;
  supportPhone: string;
  brandPrimary: string;
  brandAccent: string;
};

const toForm = (p: BusinessProfile): Form => ({
  name: p.name,
  legalName: p.legalName,
  timezone: p.timezone,
  supportEmail: p.supportEmail,
  supportPhone: p.supportPhone,
  brandPrimary: p.brandPrimary,
  brandAccent: p.brandAccent,
});

function BusinessInfoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyBusinessProfile);
  const fetchContext = useServerFn(getMyPortalContext);
  const save = useServerFn(updateMyBusinessProfile);

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const profileQuery = useQuery({
    queryKey: ["my-business-profile"],
    queryFn: () => fetchProfile(),
    enabled: hasSession === true,
    retry: false,
  });

  const entitlements = useQuery({
    queryKey: ["my-portal-context"],
    queryFn: () => fetchContext(),
    enabled: hasSession === true,
    retry: false,
  });

  const profile = profileQuery.data ?? null;
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !form) setForm(toForm(profile));
  }, [profile, form]);

  // Setup has not been completed yet, so there is nothing to edit here.
  useEffect(() => {
    if (profileQuery.isSuccess && profileQuery.data === null) {
      navigate({ to: "/onboarding" });
    }
  }, [profileQuery.isSuccess, profileQuery.data, navigate]);

  const mutation = useMutation({
    mutationFn: (values: Form) => save({ data: values }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["my-business-profile"] });
      queryClient.invalidateQueries({ queryKey: ["my-business"] });
    },
    onError: (e: Error) => {
      setSaved(false);
      setError(e.message);
    },
  });

  const nav = buildClientNav(entitlements.data?.features ?? []);
  const set = (patch: Partial<Form>) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  return (
    <AppShell title="Business information" navItems={nav}>
      {!profile || !form ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Loading your business…</p>
        </div>
      ) : (
        <>
          <div className="era-card p-6">
            <h2 className="text-sm font-semibold text-foreground">Across the whole system</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              These details drive your website, booking confirmations and customer messages.
              Changes apply everywhere as soon as you save.
            </p>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Plan</dt>
                <dd className="text-sm capitalize text-foreground">{profile.planTier}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Web address</dt>
                <dd className="truncate text-sm text-foreground">
                  {profile.primaryDomain ?? profile.slug}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Account status</dt>
                <dd className="text-sm capitalize text-foreground">
                  {profile.lifecycle.replace("_", " ")}
                </dd>
              </div>
            </dl>
          </div>

          <form
            className="era-card space-y-5 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (form) mutation.mutate(form);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Labelled text="Business name">
                <input
                  className={field}
                  value={form.name}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Labelled>
              <Labelled text="Legal name">
                <input
                  className={field}
                  value={form.legalName}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ legalName: e.target.value })}
                />
              </Labelled>
              <Labelled text="Timezone">
                <input
                  className={field}
                  value={form.timezone}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ timezone: e.target.value })}
                />
              </Labelled>
              <Labelled text="Support email">
                <input
                  className={field}
                  value={form.supportEmail}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ supportEmail: e.target.value })}
                />
              </Labelled>
              <Labelled text="Support phone">
                <input
                  className={field}
                  value={form.supportPhone}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ supportPhone: e.target.value })}
                />
              </Labelled>
              <Labelled text="Brand primary color">
                <input
                  className={field}
                  placeholder="#0F766E"
                  value={form.brandPrimary}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ brandPrimary: e.target.value })}
                />
              </Labelled>
              <Labelled text="Brand accent color">
                <input
                  className={field}
                  placeholder="#C0C6CC"
                  value={form.brandAccent}
                  disabled={!profile.canEdit}
                  onChange={(e) => set({ brandAccent: e.target.value })}
                />
              </Labelled>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && !mutation.isPending && (
              <p className="text-sm text-muted-foreground">Saved. Your details are up to date.</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!profile.canEdit || mutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {mutation.isPending ? "Saving…" : "Save changes"}
              </button>
              {!profile.canEdit && (
                <span className="text-xs text-muted-foreground">
                  Only account owners and admins can change these details.
                </span>
              )}
              <a
                href="mailto:support@eraleadgen.com"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Need your web address or plan changed? Contact ERA support.
              </a>
            </div>
          </form>

          <SiteContentEditor canEdit={profile.canEdit} enabled={hasSession === true} />
        </>
      )}
    </AppShell>
  );
}
