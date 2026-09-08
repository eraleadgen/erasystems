import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_bookings",
  title: "List bookings",
  description:
    "List a business's bookings, optionally filtered by status and start-date window. Newest first.",
  inputSchema: {
    business_id: z.string().uuid().describe("The business whose bookings to read."),
    status: z
      .string()
      .optional()
      .describe("Optional booking status filter, e.g. pending, confirmed, completed, cancelled."),
    from: z.string().optional().describe("Only bookings starting at or after this ISO timestamp."),
    to: z.string().optional().describe("Only bookings starting before this ISO timestamp."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ business_id, status, from, to, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("bookings")
      .select(
        "id, customer_name, customer_email, customer_phone, service_id, specialist_id, starts_at, ends_at, status, total_cents, notes",
      )
      .eq("business_id", business_id)
      .order("starts_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status);
    if (from) query = query.gte("starts_at", from);
    if (to) query = query.lt("starts_at", to);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
