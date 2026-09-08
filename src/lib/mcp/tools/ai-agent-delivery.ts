import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_ai_agent_delivery",
  title: "Get AI agent delivery status",
  description:
    "Read a business's AI SMS and voice agent build tracks: which tracks are switched on, and the manually set status of each step.",
  inputSchema: {
    business_id: z.string().uuid().describe("The business whose delivery status to read."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ business_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [tracks, steps] = await Promise.all([
      supabase
        .from("business_ai_agent_tracks")
        .select("track, is_enabled")
        .eq("business_id", business_id),
      supabase
        .from("business_ai_agent_steps")
        .select("track, step_key, status, note, updated_at")
        .eq("business_id", business_id),
    ]);
    const error = tracks.error ?? steps.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const payload = {
      enabledTracks: (tracks.data ?? []).filter((t) => t.is_enabled).map((t) => t.track),
      steps: steps.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
