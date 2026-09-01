/**
 * Server-only per-IP throttle for invite lookups.
 *
 * Worker instances are stateless, so the counter lives in the database rather
 * than in memory. Elevated client is used here because the caller is anonymous
 * by definition; it touches no tenant data and only ever reads/writes a counter
 * keyed by the request IP (see docs/elevated-access.md).
 */

export async function isThrottled(ip: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("invite_throttle_check", { _ip: ip });
  if (error) return false; // fail open on counter errors; the token is still 256-bit
  return Boolean(data);
}

export async function recordAttempt(ip: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.rpc("invite_throttle_record", { _ip: ip });
}
