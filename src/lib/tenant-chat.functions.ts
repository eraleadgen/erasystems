import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { getRequestHostname, isPlatformHostname, normalizeHostname } from "./tenant-hostname";
import { DAY_LABELS, WEEK_DAYS } from "./onboarding";
import { weekHoursSchema } from "./tenant-site";

/**
 * The tenant website assistant.
 *
 * Grounding rules, enforced structurally rather than by prompting alone:
 *  - the business is resolved from the request hostname on the server; the
 *    browser never says which tenant it is talking to;
 *  - the catalog, hours and contact details are read fresh from the database on
 *    every single message, so an edit made a minute ago is what gets quoted;
 *  - the model cannot state a price by writing one: it must call `quote_services`
 *    with real catalog ids, and it cannot book without calling `request_booking`,
 *    which goes through the same guarded `request_tenant_booking` routine the
 *    manual booking form uses. There is no second pricing path.
 */

const MODEL = "openai/gpt-5.6-luna";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MAX_TURNS = 24; // visitor+assistant messages carried per conversation
const MAX_TOOL_STEPS = 4;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().max(2000),
});

const input = z.object({
  businessId: z.string().uuid(),
  visitorKey: z.string().trim().min(6).max(80),
  messages: z.array(messageSchema).min(1).max(MAX_TURNS),
});

export type TenantChatReply = {
  ok: boolean;
  reply: string;
  /** true when the daily allowance stopped the assistant */
  limited?: boolean;
  booked?: { totalCents: number; minutes: number } | null;
};

function anonClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (i, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(i, { ...init, headers });
      },
    },
  });
}

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function hoursLines(raw: unknown) {
  const parsed = weekHoursSchema.safeParse(raw ?? {});
  if (!parsed.success) return [] as string[];
  const hours = parsed.data;
  return WEEK_DAYS.flatMap((day) => {
    const entry = hours[day];
    if (!entry) return [];
    return [`${DAY_LABELS[day]}: ${entry.closed ? "closed" : `${entry.open}–${entry.close}`}`];
  });
}

/**
 * Which business this request belongs to, decided server-side from the hostname
 * exactly like the public site. A client-supplied businessId is only ever
 * accepted when it matches what the hostname resolves to.
 */
async function resolveBusinessId(
  supabase: NonNullable<ReturnType<typeof anonClient>>,
  claimed: string,
) {
  const request = getRequest();
  const hostname = getRequestHostname(request);
  if (isPlatformHostname(hostname)) return claimed; // preview/dev host
  const normalized = normalizeHostname(hostname);
  if (!normalized) return null;
  const { data: domain } = await supabase
    .from("business_domains")
    .select("business_id")
    .eq("hostname", normalized)
    .maybeSingle();
  if (!domain) return null;
  return domain.business_id === claimed ? domain.business_id : null;
}

type Ctx = {
  businessId: string;
  name: string;
  timezone: string;
  supportEmail: string | null;
  supportPhone: string | null;
  services: {
    id: string;
    name: string;
    description: string | null;
    base_price_cents: number;
    duration_minutes: number;
  }[];
  hours: string[];
  serviceArea: string;
  bookingEnabled: boolean;
  requiresAddress: boolean;
};

async function loadContext(
  supabase: NonNullable<ReturnType<typeof anonClient>>,
  businessId: string,
): Promise<Ctx | null> {
  const [{ data: business }, { data: services }, { data: site }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, timezone, support_email, support_phone, lifecycle, is_active")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, description, base_price_cents, duration_minutes")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("business_site")
      .select("hours, service_area, booking_enabled, service_location")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  if (!business || !business.is_active || business.lifecycle !== "active") return null;

  return {
    businessId,
    name: business.name,
    timezone: business.timezone,
    supportEmail: business.support_email,
    supportPhone: business.support_phone,
    services: services ?? [],
    hours: hoursLines(site?.hours),
    serviceArea: site?.service_area ?? "",
    bookingEnabled: site?.booking_enabled !== false,
    requiresAddress: site?.service_location === "at_customer",
  };
}

function systemPrompt(ctx: Ctx) {
  const catalog = ctx.services.length
    ? ctx.services
        .map(
          (s) =>
            `- id=${s.id} | ${s.name} | ${money(s.base_price_cents)} | ${s.duration_minutes} min${
              s.description ? ` | ${s.description}` : ""
            }`,
        )
        .join("\n")
    : "(no services published yet)";

  return [
    `You are the website assistant for ${ctx.name}. You speak only for ${ctx.name}.`,
    `Current time: ${new Date().toISOString()} (business timezone ${ctx.timezone}).`,
    "",
    "LIVE SERVICE CATALOG (the only services that exist):",
    catalog,
    "",
    ctx.hours.length ? `OPENING HOURS:\n${ctx.hours.join("\n")}` : "OPENING HOURS: not published.",
    ctx.serviceArea ? `SERVICE AREA: ${ctx.serviceArea}` : "",
    ctx.supportPhone ? `PHONE: ${ctx.supportPhone}` : "",
    ctx.supportEmail ? `EMAIL: ${ctx.supportEmail}` : "",
    "",
    "HARD RULES:",
    "1. Never state, estimate, or imply a price yourself. To give any price or total, call the quote_services tool with real catalog ids and repeat only what it returns.",
    "2. Never claim a service exists unless it is in the catalog above. If asked for something not listed, say plainly that it is not offered and suggest the closest listed service or the phone/email.",
    "3. Never promise a specific appointment slot as confirmed. Bookings are requests: call request_booking, then tell the visitor the team will confirm.",
    "4. Never invent hours, policies, guarantees, timelines, staff names, or availability that are not in the data above.",
    "5. Never discuss, compare, rate, or affirm anything about competitors or other companies' prices, and never speculate about them. Say you can only speak for this business, then return to its services.",
    "6. Never share, guess, or confirm anything personal about the owner, staff, or any customer — no names beyond what is above, no whereabouts, no history, no opinions about them.",
    "7. Politely decline anything unrelated to this business (news, politics, medical/legal/financial advice, other businesses, general chit-chat that drifts) and steer back to its services, hours, or booking.",
    "8. If you are unsure, say so and offer the phone number or email above. Never fill a gap with a plausible guess.",
    "",
    "Style: brief, warm, plain language. Two or three sentences at most unless listing services.",
    "Format: plain text only. No markdown, no asterisks, no headings. Use simple \"-\" bullets for lists.",
  ]
    .filter(Boolean)
    .join("\n");
}

const tools = [
  {
    type: "function",
    name: "quote_services",
    description:
      "Price one or more services from this business's real catalog. The only way to state a price or duration.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        service_ids: {
          type: "array",
          items: { type: "string" },
          description: "Catalog ids exactly as listed in the system message.",
        },
      },
      required: ["service_ids"],
    },
  },
  {
    type: "function",
    name: "request_booking",
    description:
      "Create a pending booking request. Only call after the visitor has given their name, phone, the services they want, and a date and time.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        service_ids: { type: "array", items: { type: "string" } },
        customer_name: { type: "string" },
        customer_phone: { type: "string" },
        customer_email: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        notes: { type: ["string", "null"] },
        starts_at: {
          type: "string",
          description: "Requested start as an ISO 8601 timestamp with timezone offset.",
        },
      },
      required: [
        "service_ids",
        "customer_name",
        "customer_phone",
        "customer_email",
        "address",
        "notes",
        "starts_at",
      ],
    },
  },
];

async function runQuote(ctx: Ctx, ids: unknown) {
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  const known = ctx.services.filter((s) => list.includes(s.id));
  const unknown = list.filter((id) => !ctx.services.some((s) => s.id === id));
  if (!known.length) {
    return { error: "No matching service in this business's catalog. Do not quote a price." };
  }
  const totalCents = known.reduce((sum, s) => sum + s.base_price_cents, 0);
  const minutes = known.reduce((sum, s) => sum + s.duration_minutes, 0);
  return {
    services: known.map((s) => ({ name: s.name, price: money(s.base_price_cents), minutes: s.duration_minutes })),
    total: money(totalCents),
    total_minutes: minutes,
    ...(unknown.length ? { ignored_unknown_ids: unknown } : {}),
  };
}

async function runBooking(
  supabase: NonNullable<ReturnType<typeof anonClient>>,
  ctx: Ctx,
  args: Record<string, unknown>,
) {
  if (!ctx.bookingEnabled) return { error: "Online booking is turned off. Offer the phone or email." };
  const ids = Array.isArray(args["service_ids"])
    ? (args["service_ids"] as unknown[]).filter(
        (x): x is string => typeof x === "string" && ctx.services.some((s) => s.id === x),
      )
    : [];
  if (!ids.length) return { error: "No valid service selected. Ask the visitor which listed service they want." };

  const startsAtRaw = String(args["starts_at"] ?? "");
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
    return { error: "Need a valid future date and time. Ask the visitor for one." };
  }
  const name = String(args["customer_name"] ?? "").trim();
  const phone = String(args["customer_phone"] ?? "").trim();
  if (name.length < 2 || phone.length < 7) {
    return { error: "Need the visitor's name and phone number before booking." };
  }
  if (ctx.requiresAddress && !String(args["address"] ?? "").trim()) {
    return { error: "This business travels to the customer. Ask for the service address." };
  }

  const { data: rows, error } = await supabase.rpc("request_tenant_booking", {
    _business_id: ctx.businessId,
    _service_ids: ids,
    _multiplier: 1,
    _customer_name: name,
    _customer_phone: phone,
    _customer_email: String(args["customer_email"] ?? "").trim(),
    _address: String(args["address"] ?? "").trim(),
    _subject: "Requested through the website assistant",
    _notes: String(args["notes"] ?? "").trim(),
    _starts_at: startsAt.toISOString(),
  });
  if (error) return { error: error.message };
  const result = Array.isArray(rows) ? rows[0] : rows;
  return {
    status: "pending",
    total: money(result?.total_cents ?? 0),
    total_cents: result?.total_cents ?? 0,
    minutes: result?.minutes ?? 0,
    note: "Tell the visitor the request is in and the team will confirm the time.",
  };
}

/** One streamed gateway call; the text is accumulated server-side. */
async function callGateway(apiKey: string, body: Record<string, unknown>) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`gateway ${res.status}: ${detail.slice(0, 300)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: Record<string, unknown> | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; response?: Record<string, unknown> };
        if (event.type === "response.completed" && event.response) completed = event.response;
      } catch {
        // ignore partial/unknown events
      }
    }
  }

  return completed;
}

export const sendTenantChatMessage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }): Promise<TenantChatReply> => {
    const supabase = anonClient();
    if (!supabase) return { ok: false, reply: "Chat isn't available right now." };

    const businessId = await resolveBusinessId(supabase, data.businessId);
    if (!businessId) return { ok: false, reply: "Chat isn't available on this address." };

    const ctx = await loadContext(supabase, businessId);
    if (!ctx) return { ok: false, reply: "Chat isn't available right now." };

    // Daily allowance: per visitor and per business, reset automatically at
    // 00:00 UTC because rows are keyed by calendar day.
    const { data: gateRows, error: gateError } = await supabase.rpc("tenant_chat_consume", {
      _business_id: businessId,
      _visitor_key: data.visitorKey,
    });
    if (gateError) return { ok: false, reply: "Chat isn't available right now." };
    const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;

    if (gate?.just_capped) {
      // Nobody should discover this by silence: tell the owner and ERA support.
      void notifyChatCap(ctx, gate.business_messages ?? 0);
    }

    if (!gate?.allowed) {
      const contact = ctx.supportPhone
        ? `Please call ${ctx.supportPhone}.`
        : ctx.supportEmail
          ? `Please email ${ctx.supportEmail}.`
          : "Please use the contact details on this page.";
      return {
        ok: true,
        limited: true,
        reply:
          gate?.reason === "visitor_cap"
            ? `We've hit the chat limit for today. ${contact}`
            : `The assistant is taking a break for today. ${contact}`,
      };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, reply: "Chat isn't configured yet." };

    const history = data.messages.slice(-MAX_TURNS);
    const conversation: Record<string, unknown>[] = history.map((m) => ({
      type: "message",
      role: m.role,
      content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: m.content }],
    }));

    let booked: { totalCents: number; minutes: number } | null = null;

    try {
      for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
        const response = await callGateway(apiKey, {
          model: MODEL,
          instructions: systemPrompt(ctx),
          input: conversation,
          tools,
          max_output_tokens: 700,
          store: false,
        });

        const output = (response?.["output"] as Record<string, unknown>[] | undefined) ?? [];
        const calls = output.filter((item) => item["type"] === "function_call");

        if (!calls.length) {
          const text =
            (response?.["output_text"] as string | undefined) ??
            output
              .flatMap((item) => (item["content"] as Record<string, unknown>[] | undefined) ?? [])
              .filter((part) => part["type"] === "output_text")
              .map((part) => String(part["text"] ?? ""))
              .join("");
          const reply = text.trim();
          return {
            ok: true,
            booked,
            reply:
              reply ||
              `Sorry — I didn't catch that. ${
                ctx.supportPhone ? `You can reach us on ${ctx.supportPhone}.` : ""
              }`.trim(),
          };
        }

        // Round-trip the model's own items, then append each tool result.
        conversation.push(...output);
        for (const call of calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(String(call["arguments"] ?? "{}")) as Record<string, unknown>;
          } catch {
            args = {};
          }
          const name = String(call["name"] ?? "");
          const result =
            name === "quote_services"
              ? await runQuote(ctx, args["service_ids"])
              : name === "request_booking"
                ? await runBooking(supabase, ctx, args)
                : { error: "Unknown tool." };

          if (name === "request_booking" && "total_cents" in result) {
            booked = {
              totalCents: Number(result["total_cents"] ?? 0),
              minutes: Number(result["minutes"] ?? 0),
            };
          }

          conversation.push({
            type: "function_call_output",
            call_id: String(call["call_id"] ?? ""),
            output: JSON.stringify(result),
          });
        }
      }
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      console.error("tenant chat failed", error);
      if (status === 429) {
        return { ok: false, reply: "A lot of people are chatting right now — please try again in a moment." };
      }
      return {
        ok: false,
        reply: ctx.supportPhone
          ? `Sorry, I'm having trouble right now. Please call ${ctx.supportPhone}.`
          : "Sorry, I'm having trouble right now. Please use the contact details on this page.",
      };
    }

    return { ok: true, booked, reply: "Let me get someone from the team to follow up with you." };
  });

/** One-off notice, per business per day, when the assistant's daily allowance runs out. */
async function notifyChatCap(ctx: Ctx, messages: number) {
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const recipients = [ctx.supportEmail, "support@eraleadgen.com"].filter(
      (x): x is string => Boolean(x),
    );
    const day = new Date().toISOString().slice(0, 10);
    for (const to of recipients) {
      await sendTemplateEmail("chat-limit-reached", to, {
        idempotencyKey: `chat-cap-${ctx.businessId}-${day}-${to}`,
        templateData: {
          businessName: ctx.name,
          messages,
          resetsAt: "midnight UTC tonight",
        },
      });
    }
  } catch (error) {
    console.error("chat cap notification failed", error);
  }
}
