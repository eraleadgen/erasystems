import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  createAgencyDocument,
  deleteAgencyDocument,
  getDocumentUrl,
  listAgencyDocuments,
  type AgencyDocument,
  type DocumentCategory,
} from "@/lib/agency.functions";

export type LibraryOption = { value: DocumentCategory; label: string };

/**
 * Staff-only file and link library. Files live in the private
 * `agency-documents` bucket and are opened through short-lived signed links.
 */
export function DocumentLibrary({
  options,
  groups,
  hasSession,
}: {
  options: LibraryOption[];
  /** Section headings rendered from a document's own labelled kind. */
  groups: { key: string; label: string; hint?: string }[];
  hasSession: boolean;
}) {
  const fetchDocuments = useServerFn(listAgencyDocuments);
  const addDocument = useServerFn(createAgencyDocument);
  const removeDocument = useServerFn(deleteAgencyDocument);
  const signUrl = useServerFn(getDocumentUrl);
  const queryClient = useQueryClient();

  const categories = options.map((o) => o.value);
  const queryKey = ["agency-documents", categories.join(",")];

  const [category, setCategory] = useState<DocumentCategory>(options[0]!.value);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const documentsQuery = useQuery({
    queryKey,
    queryFn: () => fetchDocuments({ data: { categories } }),
    enabled: hasSession,
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeDocument({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  async function open(doc: AgencyDocument) {
    if (doc.linkUrl) {
      window.open(doc.linkUrl, "_blank", "noopener");
      return;
    }
    if (!doc.filePath) return;
    try {
      const { url } = await signUrl({ data: { path: doc.filePath } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open that file.");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!file && !linkUrl.trim()) {
      setError("Attach a file or paste a link.");
      return;
    }
    setBusy(true);
    try {
      let filePath = "";
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        filePath = `${category}/${Date.now()}-${safe}`;
        const { error: uploadError } = await supabase.storage
          .from("agency-documents")
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
      }
      await addDocument({
        data: {
          category,
          title: title.trim(),
          description: description.trim(),
          linkUrl: linkUrl.trim(),
          filePath,
        },
      });
      setTitle("");
      setDescription("");
      setLinkUrl("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that document.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasSession) {
    return (
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">Sign in with a staff account to continue.</p>
      </div>
    );
  }

  const docs = documentsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="era-card space-y-4 p-6">
        <h2 className="text-sm font-semibold text-foreground">Add to the library</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              placeholder="Service agreement v1"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-muted-foreground">
          Notes
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-muted-foreground">
            File
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Or a link
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save document"}
        </button>
      </form>

      {groups.map((group) => {
        const items = docs.filter((d) => d.category === group.key);
        return (
          <section key={group.key} className="era-card p-6">
            <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
            {group.hint && <p className="mt-1 text-xs text-muted-foreground">{group.hint}</p>}
            {items.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing stored here yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {items.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background/40 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{doc.title}</p>
                      {doc.description && (
                        <p className="truncate text-xs text-muted-foreground">{doc.description}</p>
                      )}
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {doc.linkUrl ? "Link" : "File"} ·{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => open(doc)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(doc.id)}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
