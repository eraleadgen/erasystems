import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Agency-console reads and writes for discovery calls and the internal document
 * library. Everything goes through the caller's RLS-scoped client: both tables
 * are staff-only at the policy level, so a client session sees nothing.
 */

export type DiscoveryCall = {
  id: string;
  fullName: string;
  businessName: string;
  email: string;
  phone: string | null;
  businessType: string | null;
  message: string | null;
  status: string;
  scheduledStart: string | null;
  createdAt: string;
};

export const listDiscoveryCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscoveryCall[]> => {
    const { data, error } = await context.supabase
      .from("discovery_requests")
      .select(
        "id, full_name, business_name, email, phone, business_type, message, status, scheduled_start, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      businessName: r.business_name,
      email: r.email,
      phone: r.phone,
      businessType: r.business_type,
      message: r.message,
      status: r.status,
      scheduledStart: r.scheduled_start,
      createdAt: r.created_at,
    }));
  });

export const setDiscoveryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "scheduled", "completed", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("discovery_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const DOCUMENT_CATEGORIES = ["legal", "contract", "sales"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type AgencyDocument = {
  id: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  filePath: string | null;
  linkUrl: string | null;
  businessId: string | null;
  createdAt: string;
};

const categoryInput = z.object({ categories: z.array(z.enum(DOCUMENT_CATEGORIES)).min(1) });

export const listAgencyDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => categoryInput.parse(input))
  .handler(async ({ data, context }): Promise<AgencyDocument[]> => {
    const { data: rows, error } = await context.supabase
      .from("agency_documents")
      .select("id, category, title, description, file_path, link_url, business_id, created_at")
      .in("category", data.categories)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      category: r.category as DocumentCategory,
      title: r.title,
      description: r.description,
      filePath: r.file_path,
      linkUrl: r.link_url,
      businessId: r.business_id,
      createdAt: r.created_at,
    }));
  });

export const createAgencyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.enum(DOCUMENT_CATEGORIES),
        title: z.string().trim().min(2).max(160),
        description: z.string().trim().max(1000).optional().or(z.literal("")),
        linkUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
        filePath: z.string().trim().max(500).optional().or(z.literal("")),
        businessId: z.string().uuid().optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agency_documents").insert({
      category: data.category,
      title: data.title,
      description: data.description || null,
      link_url: data.linkUrl || null,
      file_path: data.filePath || null,
      business_id: data.businessId || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteAgencyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("agency_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase.from("agency_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    if (row?.file_path) {
      await context.supabase.storage.from("agency-documents").remove([row.file_path]);
    }
    return { ok: true as const };
  });

/** Short-lived download link for a stored file; storage RLS is staff-only. */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("agency-documents")
      .createSignedUrl(data.path, 300);
    if (error || !signed) throw new Error(error?.message ?? "Could not open that file.");
    return { url: signed.signedUrl };
  });
