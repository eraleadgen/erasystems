import { supabase } from "@/integrations/supabase/client";

async function call(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof json["error"] === "string" ? (json["error"] as string) : "Something went wrong.");
  return json;
}

/** True when this browser is already remembered; otherwise a code is emailed. */
export async function startDeviceCheck(resend = false) {
  return (await call("/api/public/device/start", { resend })) as { trusted: boolean; email?: string; wait?: boolean };
}

export async function verifyDeviceCode(code: string, remember: boolean) {
  await call("/api/public/device/verify", { code, remember });
}

export function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
