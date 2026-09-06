import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callerBusiness, type Ctx } from "./customers.functions";

/**
 * Specialists and job assignment.
 *
 * Same shape as everything else: business_id-scoped reads through the caller's
 * own RLS client. A specialist login can only read the bookings assigned to
 * them (enforced by policy, not by this code), and only owners/admins can
 * create specialists or assign work.
 */

export type SpecialistRow = {
  id: string;
  displayName: string;
  title: string | null;
  isActive: boolean;
  userId: string | null;
  serviceIds: string[];
  hours: { id: string; weekday: number; startMinute: number; endMinute: number }[];
  assignedCount: number;
};

export type AssignedJob = {
  id: string;
  customerName: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  totalCents: number;
  notes: string | null;
};

export const listSpecialists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SpecialistRow[]> => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) return [];

    const { data: specialists } = await context.supabase
      .from("specialist_profiles")
      .select("id, display_name, title, is_active, user_id")
      .eq("business_id", membership.businessId)
      .order("display_name", { ascending: true });

    const ids = (specialists ?? []).map((s) => s.id);
    if (ids.length === 0) return [];

    const [{ data: services }, { data: hours }, { data: bookings }] = await Promise.all([
      context.supabase.from("specialist_services").select("specialist_id, service_id").in("specialist_id", ids),
      context.supabase
        .from("specialist_hours")
        .select("id, specialist_id, weekday, start_minute, end_minute")
        .in("specialist_id", ids),
      context.supabase
        .from("bookings")
        .select("specialist_id")
        .eq("business_id", membership.businessId)
        .in("specialist_id", ids),
    ]);

    return (specialists ?? []).map((s) => ({
      id: s.id,
      displayName: s.display_name,
      title: s.title,
      isActive: s.is_active,
      userId: s.user_id,
      serviceIds: (services ?? []).filter((r) => r.specialist_id === s.id).map((r) => r.service_id),
      hours: (hours ?? [])
        .filter((h) => h.specialist_id === s.id)
        .map((h) => ({
          id: h.id,
          weekday: h.weekday,
          startMinute: h.start_minute,
          endMinute: h.end_minute,
        }))
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
      assignedCount: (bookings ?? []).filter((b) => b.specialist_id === s.id).length,
    }));
  });

const saveSpecialistInput = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional().default(""),
  isActive: z.boolean().default(true),
  serviceIds: z.array(z.string().uuid()).max(60).default([]),
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
      }),
    )
    .max(21)
    .default([]),
});

export const saveSpecialist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSpecialistInput.parse(input))
  .handler(async ({ data, context }) => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) throw new Error("No business found for your account.");

    let specialistId = data.id ?? null;
    const payload = {
      business_id: membership.businessId,
      display_name: data.displayName,
      title: data.title || null,
      is_active: data.isActive,
    };

    if (specialistId) {
      const { error } = await context.supabase
        .from("specialist_profiles")
        .update(payload)
        .eq("id", specialistId)
        .eq("business_id", membership.businessId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("specialist_profiles")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      specialistId = row.id;
    }

    await context.supabase.from("specialist_services").delete().eq("specialist_id", specialistId);
    if (data.serviceIds.length > 0) {
      const { error } = await context.supabase
        .from("specialist_services")
        .insert(data.serviceIds.map((service_id) => ({ specialist_id: specialistId!, service_id })));
      if (error) throw new Error(error.message);
    }

    await context.supabase.from("specialist_hours").delete().eq("specialist_id", specialistId);
    if (data.hours.length > 0) {
      const { error } = await context.supabase.from("specialist_hours").insert(
        data.hours.map((h) => ({
          specialist_id: specialistId!,
          weekday: h.weekday,
          start_minute: h.startMinute,
          end_minute: h.endMinute,
        })),
      );
      if (error) throw new Error(error.message);
    }

    return { ok: true, id: specialistId };
  });

export const deleteSpecialist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) throw new Error("No business found for your account.");
    const { error } = await context.supabase
      .from("specialist_profiles")
      .delete()
      .eq("id", data.id)
      .eq("business_id", membership.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link an existing team login to a specialist record, so they see their jobs. */
export const linkSpecialistLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ specialistId: z.string().uuid(), memberUserId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) throw new Error("No business found for your account.");

    if (data.memberUserId) {
      const { data: member } = await context.supabase
        .from("business_members")
        .select("id")
        .eq("business_id", membership.businessId)
        .eq("user_id", data.memberUserId)
        .maybeSingle();
      if (!member) throw new Error("That login is not a member of your business.");
    }

    const { error } = await context.supabase
      .from("specialist_profiles")
      .update({ user_id: data.memberUserId })
      .eq("id", data.specialistId)
      .eq("business_id", membership.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignBookingSpecialist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ bookingId: z.string().uuid(), specialistId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const membership = await callerBusiness(context as Ctx);
    if (!membership) throw new Error("No business found for your account.");

    if (data.specialistId) {
      const { data: sp } = await context.supabase
        .from("specialist_profiles")
        .select("id")
        .eq("id", data.specialistId)
        .eq("business_id", membership.businessId)
        .maybeSingle();
      if (!sp) throw new Error("That specialist is not in your business.");
    }

    const { error } = await context.supabase
      .from("bookings")
      .update({ specialist_id: data.specialistId })
      .eq("id", data.bookingId)
      .eq("business_id", membership.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** A signed-in specialist's own jobs for one business. RLS does the filtering. */
export const getMyAssignedJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ name: string; jobs: AssignedJob[] } | null> => {
    const { data: profile } = await context.supabase
      .from("specialist_profiles")
      .select("id, display_name")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile) return null;

    const { data: rows } = await context.supabase
      .from("bookings")
      .select("id, customer_name, starts_at, ends_at, status, total_cents, notes")
      .eq("business_id", data.businessId)
      .eq("specialist_id", profile.id)
      .order("starts_at", { ascending: true });

    return {
      name: profile.display_name,
      jobs: (rows ?? []).map((r) => ({
        id: r.id,
        customerName: r.customer_name,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        status: r.status,
        totalCents: r.total_cents,
        notes: r.notes,
      })),
    };
  });

/** A specialist marking their own job done or a no-show. */
export const setJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(["confirmed", "completed", "no_show", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
