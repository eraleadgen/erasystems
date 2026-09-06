import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { sendTenantChatMessage } from "@/lib/tenant-chat.functions";

/**
 * The website assistant bubble every tenant gets, on every tier.
 *
 * It carries no business knowledge of its own: the server resolves the tenant
 * from the hostname and grounds each answer in that business's live catalog.
 */

type Msg = { role: "user" | "assistant"; content: string };

const VISITOR_KEY = "era-chat-visitor";

function visitorKey() {
  if (typeof window === "undefined") return "server";
  let key = window.localStorage.getItem(VISITOR_KEY);
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, key);
  }
  return key;
}

export function TenantChatWidget({
  businessId,
  businessName,
  primary,
  accent,
}: {
  businessId: string;
  businessName: string;
  primary: string;
  accent?: string | undefined;
}) {
  const send = useServerFn(sendTenantChatMessage);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(
    () => `Hi! Ask me anything about ${businessName} — services, prices, hours, or booking a time.`,
    [businessName],
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const result = await send({
        data: { businessId, visitorKey: visitorKey(), messages: next.slice(-24) },
      });
      setMessages((current) => [...current, { role: "assistant", content: result.reply }]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Sorry — something went wrong. Please try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
          style={{ borderColor: `${primary}33` }}
          role="dialog"
          aria-label={`Chat with ${businessName}`}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ background: primary }}>
            <p className="text-sm font-semibold text-white">{businessName}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded px-2 text-lg leading-none text-white/80 hover:text-white"
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-4">
            <p className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm">
              {greeting}
            </p>
            {messages.map((message, index) => (
              <p
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm"
                }
                style={message.role === "user" ? { background: accent || primary } : undefined}
              >
                {message.content}
              </p>
            ))}
            {busy ? <p className="text-xs text-neutral-500">Typing…</p> : null}
          </div>

          <form onSubmit={submit} className="flex gap-2 border-t bg-white p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={2000}
              placeholder="Type your question…"
              aria-label="Message"
              className="flex-1 rounded-full border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: primary }}
            >
              Send
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
        style={{ background: primary }}
        aria-label={open ? "Hide chat" : `Chat with ${businessName}`}
      >
        {open ? "Hide chat" : "Chat with us"}
      </button>
    </div>
  );
}
