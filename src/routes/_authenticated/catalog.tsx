import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PortalPage } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";
import {
  createService,
  deleteService,
  setServiceActive,
  updateService,
} from "@/lib/catalog.functions";
import type { PortalWorkspace } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog | ERA App" },
      {
        name: "description",
        content: "Add, edit and publish the services shown on your client facing website.",
      },
      { property: "og:title", content: "Catalog | ERA App" },
      {
        property: "og:description",
        content: "Add, edit and publish the services shown on your client facing website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CatalogPage,
});

const inputClass =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary";

type Draft = {
  name: string;
  description: string;
  price: string;
  durationMinutes: string;
  isActive: boolean;
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  price: "",
  durationMinutes: "60",
  isActive: true,
};

function toPayload(draft: Draft) {
  return {
    name: draft.name,
    description: draft.description,
    basePriceCents: Math.round(Number(draft.price || 0) * 100),
    durationMinutes: Number(draft.durationMinutes || 0),
    isActive: draft.isActive,
  };
}

function CatalogPage() {
  return (
    <PortalPage title="Catalog" feature="core_engines" empty="No services yet.">
      {(ws) => <CatalogEditor workspace={ws} />}
    </PortalPage>
  );
}

function CatalogEditor({ workspace }: { workspace: PortalWorkspace }) {
  const queryClient = useQueryClient();
  const add = useServerFn(createService);
  const edit = useServerFn(updateService);
  const toggle = useServerFn(setServiceActive);
  const remove = useServerFn(deleteService);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setError(null);
    return queryClient.invalidateQueries({ queryKey: ["portal-workspace"] });
  };
  const onError = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong");

  const addMutation = useMutation({
    mutationFn: () => add({ data: toPayload(draft) }),
    onSuccess: async () => {
      setDraft(emptyDraft);
      await refresh();
    },
    onError,
  });

  const editMutation = useMutation({
    mutationFn: () => edit({ data: { id: editingId!, ...toPayload(editDraft) } }),
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
    onError,
  });

  const toggleMutation = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => toggle({ data: v }),
    onSuccess: refresh,
    onError,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
    onError,
  });

  const busy =
    addMutation.isPending ||
    editMutation.isPending ||
    toggleMutation.isPending ||
    removeMutation.isPending;

  return (
    <div className="space-y-6">
      <section className="era-card p-6">
        <h2 className="text-base font-semibold">Add a service</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Published services appear on your client facing website right away.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Service name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className={inputClass}
            placeholder="Description (optional)"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="Price in dollars"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
          />
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder="Duration in minutes"
            value={draft.durationMinutes}
            onChange={(e) => setDraft({ ...draft, durationMinutes: e.target.value })}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Publish on my website
          </label>
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            disabled={busy || !draft.name.trim()}
            onClick={() => addMutation.mutate()}
          >
            {addMutation.isPending ? "Adding…" : "Add service"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <section className="era-card overflow-hidden">
        <ul className="divide-y divide-border/60">
          {workspace.services.map((s) =>
            editingId === s.id ? (
              <li key={s.id} className="space-y-3 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={inputClass}
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    value={editDraft.price}
                    onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={editDraft.durationMinutes}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, durationMinutes: e.target.value })
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editDraft.isActive}
                      onChange={(e) => setEditDraft({ ...editDraft, isActive: e.target.checked })}
                    />
                    Published
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    disabled={busy}
                    onClick={() => editMutation.mutate()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.name}{" "}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                        s.isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.isActive ? "Live on website" : "Hidden"}
                    </span>
                  </p>
                  {s.description && (
                    <p className="truncate text-xs text-muted-foreground">{s.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{s.durationMinutes} min</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-foreground">{formatMoney(s.basePriceCents)}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditingId(s.id);
                      setEditDraft({
                        name: s.name,
                        description: s.description,
                        price: (s.basePriceCents / 100).toString(),
                        durationMinutes: String(s.durationMinutes),
                        isActive: s.isActive,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                    disabled={busy}
                    onClick={() => toggleMutation.mutate({ id: s.id, isActive: !s.isActive })}
                  >
                    {s.isActive ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:opacity-80 disabled:opacity-60"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Remove ${s.name}? This also removes it from your website.`)) {
                        removeMutation.mutate(s.id);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ),
          )}
          {workspace.services.length === 0 && (
            <li className="p-5 text-sm text-muted-foreground">
              No services yet. Add your first one above.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
