import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_customers",
  title: "List customers",
  description: "List a business's customer records, optionally filtered by a name or email search.",
  inputSchema: {
    business_id: z.string().uuid().describe("The business whose customers to read."),
    search: z.string().trim().min(1).optional().describe("Match against name or email."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ business_id, search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("customers")
      .select("id, full_name, email, phone, notes, created_at")
      .eq("business_id", business_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (search) {
      const term = search.replace(/[%,()]/g, "");
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { customers: data ?? [] },
    };
  },
});
