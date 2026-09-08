import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_services",
  title: "List services",
  description:
    "List one business's service catalog: name, description, price in cents and duration in minutes.",
  inputSchema: {
    business_id: z.string().uuid().describe("The business whose catalog to read."),
    include_inactive: z.boolean().optional().describe("Include services that are switched off."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ business_id, include_inactive }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("services")
      .select("id, name, description, base_price_cents, duration_minutes, is_active, sort_order")
      .eq("business_id", business_id)
      .order("sort_order");
    if (!include_inactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { services: data ?? [] },
    };
  },
});
