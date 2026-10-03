import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type CSSProperties } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getMyPortalTheme, saveMyPortalTheme } from "@/lib/business-profile.functions";

/** Shared query for the client's portal look. */
export function usePortalTheme(enabled: boolean) {
  const fetchTheme = useServerFn(getMyPortalTheme);
  return useQuery({
    queryKey: ["portal-theme"],
    queryFn: () => fetchTheme(),
    enabled,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "";
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? "#0f1a17" : "#ffffff";
}

/** CSS variables that recolor the portal with the client's brand color. */
export function brandVars(brandPrimary: string | undefined): CSSProperties {
  const fg = brandPrimary ? readableOn(brandPrimary) : "";
  if (!brandPrimary || !fg) return {};
  return {
    ["--primary" as string]: brandPrimary,
    ["--ring" as string]: brandPrimary,
    ["--primary-foreground" as string]: fg,
  };
}

export function PortalThemeEditor({ canEdit }: { canEdit: boolean }) {
  const theme = usePortalTheme(true);
  const save = useServerFn(saveMyPortalTheme);
  const qc = useQueryClient();
  const [mode, setMode] = useState<"light" | "dark">("dark");
  const [color, setColor] = useState("#0f766e");
  const [logoPath, setLogoPath] = useState<string | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!theme.data) return;
    setMode(theme.data.theme);
    if (theme.data.brandPrimary) setColor(theme.data.brandPrimary);
    setPreview(theme.data.logoUrl);
  }, [theme.data]);

  const m = useMutation({
    mutationFn: () => save({ data: { theme: mode, brandPrimary: color, ...(logoPath !== undefined ? { logoPath } : {}) } }),
    onSuccess: () => {
      setMsg("Saved. Your portal now uses this look.");
      void qc.invalidateQueries({ queryKey: ["portal-theme"] });
      void qc.invalidateQueries({ queryKey: ["my-business-profile"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  return (
    <section className="era-card p-6">
      <h2 className="text-base font-semibold">Portal theme</h2>
      <p className="mt-1 text-sm text-muted-foreground">Choose light or dark, your brand color and your logo.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <fieldset className="text-sm">
          <legend className="text-xs text-muted-foreground">Mode</legend>
          <div className="mt-2 flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                disabled={!canEdit}
                onClick={() => setMode(t)}
                className={`rounded-md border px-3 py-1.5 text-xs capitalize ${mode === t ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="text-xs text-muted-foreground">
          Brand color
          <input
            type="color"
            disabled={!canEdit}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="mt-2 block h-9 w-20 rounded border border-border bg-background"
          />
        </label>
        <div className="text-xs text-muted-foreground">
          Logo
          <div className="mt-2 flex items-center gap-3">
            {preview ? <img src={preview} alt="Your logo" className="h-10 w-auto rounded bg-muted p-1" /> : null}
            {canEdit && (
              <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) return setMsg("Logo must be under 2 MB.");
                    setUploading(true);
                    const { data: u } = await supabase.auth.getUser();
                    const ext = file.name.split(".").pop() ?? "png";
                    const path = `${u.user?.id}/portal-logo-${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("onboarding-logos").upload(path, file, { upsert: true });
                    setUploading(false);
                    if (error) return setMsg(error.message);
                    setLogoPath(path);
                    setPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setMsg(null);
              m.mutate();
            }}
            disabled={m.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? "Saving…" : "Save theme"}
          </button>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      )}
    </section>
  );
}
