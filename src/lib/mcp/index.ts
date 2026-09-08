import { auth, defineMcp } from "@lovable.dev/mcp-js";

import listBusinesses from "./tools/list-businesses";
import listServices from "./tools/list-services";
import listBookings from "./tools/list-bookings";
import listCustomers from "./tools/list-customers";
import aiAgentDelivery from "./tools/ai-agent-delivery";

// The OAuth issuer must be the direct Supabase host; the project ref is the one
// value that survives publish unchanged.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "era-systems-llc",
  title: "ERA Systems LLC",
  version: "0.1.0",
  instructions:
    "Read-only tools over ERA Systems client data. Start with `list_businesses` to get a business id, then pass it to `list_services`, `list_bookings`, `list_customers` or `get_ai_agent_delivery`. Every read runs as the signed-in user under the same per-business access rules as the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listBusinesses, listServices, listBookings, listCustomers, aiAgentDelivery],
});
