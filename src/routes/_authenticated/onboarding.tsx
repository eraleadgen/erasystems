import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  completeOnboarding,
  getOrCreateDraft,
  saveDraftStep,
} from "@/lib/onboarding.functions";
import {
  DAY_LABELS,
  ONBOARDING_STEPS,
  STEP_LABELS,
  WEEK_DAYS,
  emptyBasics,
  formatPrice,
  type Basics,
  type Branding,
  type Catalog,
  type Integrations,
  type OnboardingDraft,
  type Team,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your business — ERA Systems" },
      {
        name: "description",
        content:
          "Complete your ERA Systems business setup: details, branding, services and integrations. No payment required at this step.",
      },
      { property: "og:title", content: "Set up your business — ERA Systems" },
      {
        property: "og:description",
        content: "Business setup for newly registered ERA Systems clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingWizard,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-destructive">{error.message}</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-3xl">{children}</div>
    </main>
  );
}

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const label = "block text-xs font-medium text-muted-foreground";

function Labelled({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

function OnboardingWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadDraft = useServerFn(getOrCreateDraft);
  const saveStep = useServerFn(saveDraftStep);
  const finish = useServerFn(completeOnboarding);

  const draftQuery = useQuery({
    queryKey: ["onboarding-draft"],
    queryFn: () => loadDraft({ data: undefined }),
    retry: false,
  });

  const draft = draftQuery.data;

  const [stepIndex, setStepIndex] = useState(0);
  const [basics, setBasics] = useState<Basics | null>(null);
  const [branding, setBranding] = useState<Branding>({
    logoPath: null,
    brandPrimary: "",
    brandAccent: "",
  });
  const [catalog, setCatalog] = useState<Catalog>({ services: [] });
  const [team, setTeam] = useState<Team>({ members: [] });
  const [integrations, setIntegrations] = useState<Integrations>({
    desiredDomain: "",
    desiredEmail: "",
    desiredPhone: "",
    existingWebsite: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Resume: rehydrate every earlier answer and land on the saved step.
  useEffect(() => {
    if (!draft || hydrated) return;
    setBasics({ ...emptyBasics(draft.accountEmail), ...(draft.data.basics ?? {}) } as Basics);
    if (draft.data.branding) setBranding((b) => ({ ...b, ...draft.data.branding }) as Branding);
    if (draft.data.catalog?.services) setCatalog({ services: draft.data.catalog.services });
    if (draft.data.team?.members) setTeam({ members: draft.data.team.members });
    if (draft.data.integrations)
      setIntegrations((i) => ({ ...i, ...draft.data.integrations }) as Integrations);

    setStepIndex(Math.min(draft.currentStep, ONBOARDING_STEPS.length - 1));
    setHydrated(true);
  }, [draft, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async ({ next }: { next: number }) => {
      const step = ONBOARDING_STEPS[stepIndex];
      if (step === "review") return;
      const value =
        step === "basics"
          ? basics!
          : step === "branding"
            ? branding
            : step === "catalog"
              ? catalog
              : step === "team"
                ? team
                : integrations;
      const updated = await saveStep({
        data: { payload: { step, value } as never, currentStep: next },
      });
      queryClient.setQueryData(["onboarding-draft"], updated satisfies OnboardingDraft);
    },
  });

  const finishMutation = useMutation({
    mutationFn: () => finish({ data: undefined }),
    onSuccess: () => navigate({ to: "/dashboard" }),
    onError: (e: Error) => setError(e.message),
  });

  const step = ONBOARDING_STEPS[stepIndex];

  const canAdvance = useMemo(() => {
    if (step === "basics") return Boolean(basics?.legalName && basics?.displayName);
    if (step === "catalog") return catalog.services.every((s) => s.name.trim().length > 0);
    return true;
  }, [step, basics, catalog]);

  if (draftQuery.isLoading || !basics) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading your setup…</p>
      </Shell>
    );
  }

  if (draft?.status === "completed") {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-foreground">Business setup complete</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your business is set up and waiting to go live. Billing is the next step — your ERA
          Systems representative will take it from here.
        </p>
        <Link
          to="/dashboard"
          className="mt-5 inline-block rounded-md border border-border px-4 py-2 text-sm text-foreground underline-offset-4 hover:underline"
        >
          Go to your dashboard
        </Link>
      </Shell>
    );
  }

  const goTo = async (next: number) => {
    setError(null);
    try {
      await saveMutation.mutateAsync({ next });
      setStepIndex(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your progress.");
    }
  };

  return (
    <Shell>
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Set up your business</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Business details only — no payment is taken in this step. Your progress saves as you go,
          so you can leave and pick up exactly where you left off.
        </p>
      </header>

      <ol className="mt-6 flex flex-wrap gap-2">
        {ONBOARDING_STEPS.map((key, index) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => (index <= stepIndex ? goTo(index) : undefined)}
              disabled={index > stepIndex}
              className={`rounded-full px-3 py-1 text-xs ${
                index === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : index < stepIndex
                    ? "bg-muted text-foreground"
                    : "bg-muted text-muted-foreground opacity-60"
              }`}
            >
              {index + 1}. {STEP_LABELS[key]}
            </button>
          </li>
        ))}
      </ol>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        {step === "basics" ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labelled text="Legal name">
                <input
                  className={field}
                  value={basics.legalName}
                  onChange={(e) => setBasics({ ...basics, legalName: e.target.value })}
                />
              </Labelled>
              <Labelled text="Display name">
                <input
                  className={field}
                  value={basics.displayName}
                  onChange={(e) => setBasics({ ...basics, displayName: e.target.value })}
                />
              </Labelled>
              <Labelled text="Address line 1">
                <input
                  className={field}
                  value={basics.addressLine1}
                  onChange={(e) => setBasics({ ...basics, addressLine1: e.target.value })}
                />
              </Labelled>
              <Labelled text="Address line 2">
                <input
                  className={field}
                  value={basics.addressLine2}
                  onChange={(e) => setBasics({ ...basics, addressLine2: e.target.value })}
                />
              </Labelled>
              <Labelled text="City">
                <input
                  className={field}
                  value={basics.city}
                  onChange={(e) => setBasics({ ...basics, city: e.target.value })}
                />
              </Labelled>
              <Labelled text="State / region">
                <input
                  className={field}
                  value={basics.region}
                  onChange={(e) => setBasics({ ...basics, region: e.target.value })}
                />
              </Labelled>
              <Labelled text="Postal code">
                <input
                  className={field}
                  value={basics.postalCode}
                  onChange={(e) => setBasics({ ...basics, postalCode: e.target.value })}
                />
              </Labelled>
              <Labelled text="Country">
                <input
                  className={field}
                  value={basics.country}
                  onChange={(e) => setBasics({ ...basics, country: e.target.value })}
                />
              </Labelled>
              <Labelled text="Timezone">
                <input
                  className={field}
                  value={basics.timezone}
                  onChange={(e) => setBasics({ ...basics, timezone: e.target.value })}
                />
              </Labelled>
              <Labelled text="Support email">
                <input
                  className={field}
                  value={basics.supportEmail}
                  onChange={(e) => setBasics({ ...basics, supportEmail: e.target.value })}
                />
              </Labelled>
              <Labelled text="Support phone">
                <input
                  className={field}
                  value={basics.supportPhone}
                  onChange={(e) => setBasics({ ...basics, supportPhone: e.target.value })}
                />
              </Labelled>
            </div>

            <fieldset className="mt-2">
              <legend className="text-xs font-medium text-muted-foreground">Opening hours</legend>
              <div className="mt-2 space-y-2">
                {WEEK_DAYS.map((day) => {
                  const value = basics.hours[day] ?? { closed: true, open: "09:00", close: "17:00" };
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="w-24 text-foreground">{DAY_LABELS[day]}</span>
                      <label className="flex items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!value.closed}
                          onChange={(e) =>
                            setBasics({
                              ...basics,
                              hours: {
                                ...basics.hours,
                                [day]: { ...value, closed: !e.target.checked },
                              },
                            })
                          }
                        />
                        Open
                      </label>
                      <input
                        type="time"
                        disabled={value.closed}
                        value={value.open}
                        onChange={(e) =>
                          setBasics({
                            ...basics,
                            hours: { ...basics.hours, [day]: { ...value, open: e.target.value } },
                          })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1"
                      />
                      <input
                        type="time"
                        disabled={value.closed}
                        value={value.close}
                        onChange={(e) =>
                          setBasics({
                            ...basics,
                            hours: { ...basics.hours, [day]: { ...value, close: e.target.value } },
                          })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1"
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === "branding" ? (
          <BrandingStep branding={branding} onChange={setBranding} />
        ) : null}

        {step === "catalog" ? (
          <div className="space-y-4">
            {catalog.services.map((service, index) => (
              <div key={index} className="rounded-lg border border-border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Labelled text="Service name">
                    <input
                      className={field}
                      value={service.name}
                      onChange={(e) => {
                        const next = [...catalog.services];
                        next[index] = { ...service, name: e.target.value };
                        setCatalog({ services: next });
                      }}
                    />
                  </Labelled>
                  <Labelled text="Duration (minutes)">
                    <input
                      className={field}
                      type="number"
                      min={5}
                      value={service.durationMinutes}
                      onChange={(e) => {
                        const next = [...catalog.services];
                        next[index] = { ...service, durationMinutes: Number(e.target.value) || 0 };
                        setCatalog({ services: next });
                      }}
                    />
                  </Labelled>
                  <Labelled text="Price (USD)">
                    <input
                      className={field}
                      type="number"
                      min={0}
                      step="0.01"
                      value={(service.priceCents / 100).toString()}
                      onChange={(e) => {
                        const next = [...catalog.services];
                        next[index] = {
                          ...service,
                          priceCents: Math.round((Number(e.target.value) || 0) * 100),
                        };
                        setCatalog({ services: next });
                      }}
                    />
                  </Labelled>
                  <Labelled text="Description">
                    <input
                      className={field}
                      value={service.description}
                      onChange={(e) => {
                        const next = [...catalog.services];
                        next[index] = { ...service, description: e.target.value };
                        setCatalog({ services: next });
                      }}
                    />
                  </Labelled>
                </div>
                <button
                  type="button"
                  className="mt-3 text-xs text-destructive"
                  onClick={() =>
                    setCatalog({ services: catalog.services.filter((_, i) => i !== index) })
                  }
                >
                  Remove service
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
              onClick={() =>
                setCatalog({
                  services: [
                    ...catalog.services,
                    { name: "", description: "", durationMinutes: 60, priceCents: 0 },
                  ],
                })
              }
            >
              Add a service
            </button>
          </div>
        ) : null}

        {step === "team" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Optional. Listing people here does not create accounts — each one gets a proper
              invite later, the same way your own account was created.
            </p>
            {team.members.map((member, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3">
                <Labelled text="Full name">
                  <input
                    className={field}
                    value={member.fullName}
                    onChange={(e) => {
                      const next = [...team.members];
                      next[index] = { ...member, fullName: e.target.value };
                      setTeam({ members: next });
                    }}
                  />
                </Labelled>
                <Labelled text="Email">
                  <input
                    className={field}
                    value={member.email}
                    onChange={(e) => {
                      const next = [...team.members];
                      next[index] = { ...member, email: e.target.value };
                      setTeam({ members: next });
                    }}
                  />
                </Labelled>
                <Labelled text="Role / title">
                  <input
                    className={field}
                    value={member.title}
                    onChange={(e) => {
                      const next = [...team.members];
                      next[index] = { ...member, title: e.target.value };
                      setTeam({ members: next });
                    }}
                  />
                </Labelled>
                <button
                  type="button"
                  className="text-left text-xs text-destructive"
                  onClick={() => setTeam({ members: team.members.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground"
              onClick={() =>
                setTeam({ members: [...team.members, { fullName: "", email: "", title: "" }] })
              }
            >
              Add a team member
            </button>
          </div>
        ) : null}

        {step === "integrations" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Labelled text="Domain you want to use">
              <input
                className={field}
                value={integrations.desiredDomain}
                onChange={(e) => setIntegrations({ ...integrations, desiredDomain: e.target.value })}
              />
            </Labelled>
            <Labelled text="Business email address">
              <input
                className={field}
                value={integrations.desiredEmail}
                onChange={(e) => setIntegrations({ ...integrations, desiredEmail: e.target.value })}
              />
            </Labelled>
            <Labelled text="Business phone number">
              <input
                className={field}
                value={integrations.desiredPhone}
                onChange={(e) => setIntegrations({ ...integrations, desiredPhone: e.target.value })}
              />
            </Labelled>
            <Labelled text="Existing website (if any)">
              <input
                className={field}
                value={integrations.existingWebsite}
                onChange={(e) =>
                  setIntegrations({ ...integrations, existingWebsite: e.target.value })
                }
              />
            </Labelled>
            <div className="sm:col-span-2">
              <Labelled text="Anything else we should know">
                <textarea
                  className={field}
                  rows={4}
                  value={integrations.notes}
                  onChange={(e) => setIntegrations({ ...integrations, notes: e.target.value })}
                />
              </Labelled>
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Nothing is connected or verified here. These become setup tasks once billing is in
              place.
            </p>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="space-y-4 text-sm">
            <div>
              <h2 className="font-medium text-foreground">Business</h2>
              <p className="text-muted-foreground">
                {basics.displayName} ({basics.legalName})
                <br />
                {[basics.addressLine1, basics.city, basics.region, basics.postalCode]
                  .filter(Boolean)
                  .join(", ")}
                <br />
                {basics.timezone}
              </p>
            </div>
            <div>
              <h2 className="font-medium text-foreground">Branding</h2>
              <p className="text-muted-foreground">
                Logo: {branding.logoPath ? "uploaded" : "none"} · Primary:{" "}
                {branding.brandPrimary || "default"} · Accent: {branding.brandAccent || "default"}
              </p>
            </div>
            <div>
              <h2 className="font-medium text-foreground">Services</h2>
              {catalog.services.length === 0 ? (
                <p className="text-muted-foreground">No services yet.</p>
              ) : (
                <ul className="text-muted-foreground">
                  {catalog.services.map((s, i) => (
                    <li key={i}>
                      {s.name} — {s.durationMinutes} min — {formatPrice(s.priceCents)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="font-medium text-foreground">Team</h2>
              <p className="text-muted-foreground">
                {team.members.length === 0
                  ? "None listed."
                  : team.members.map((m) => m.fullName).join(", ")}
              </p>
            </div>
            <p className="rounded-md bg-muted p-3 text-muted-foreground">
              Submitting creates your business record. It stays offline until billing is set up —
              no payment is taken now.
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => goTo(stepIndex - 1)}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-50"
          >
            Back
          </button>
          {step === "review" ? (
            <button
              type="button"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {finishMutation.isPending ? "Creating your business…" : "Finish setup"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canAdvance || saveMutation.isPending}
              onClick={() => goTo(stepIndex + 1)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saveMutation.isPending ? "Saving…" : "Save & continue"}
            </button>
          )}
        </div>
      </section>
    </Shell>
  );
}

function BrandingStep({
  branding,
  onChange,
}: {
  branding: Branding;
  onChange: (value: Branding) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <span className={label}>Logo</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="mt-1 block text-sm text-muted-foreground"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setUploadError(null);
            setUploading(true);
            try {
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              if (!uid) throw new Error("Your session expired. Sign in again.");
              const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
              const path = `${uid}/logo.${extension}`;
              const { error } = await supabase.storage
                .from("onboarding-logos")
                .upload(path, file, { upsert: true });
              if (error) throw new Error(error.message);
              onChange({ ...branding, logoPath: path });
            } catch (e) {
              setUploadError(e instanceof Error ? e.message : "Upload failed.");
            } finally {
              setUploading(false);
            }
          }}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {uploading ? "Uploading…" : branding.logoPath ? "Logo uploaded." : "PNG, JPG, SVG or WebP, up to 5 MB."}
        </p>
        {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled text="Primary color">
          <input
            type="color"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background"
            value={branding.brandPrimary || "#1f2937"}
            onChange={(e) => onChange({ ...branding, brandPrimary: e.target.value })}
          />
        </Labelled>
        <Labelled text="Accent color">
          <input
            type="color"
            className="mt-1 h-10 w-full rounded-md border border-border bg-background"
            value={branding.brandAccent || "#2563eb"}
            onChange={(e) => onChange({ ...branding, brandAccent: e.target.value })}
          />
        </Labelled>
      </div>
    </div>
  );
}
