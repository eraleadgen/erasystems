import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { submitDiscoveryRequest } from "@/lib/marketing.functions";

const field =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40";

export function DiscoveryForm() {
  const submit = useServerFn(submitDiscoveryRequest);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center">
        <h3 className="text-lg font-semibold text-foreground">Request received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A member of the ERA team will reach out by email to find a time that works for you. No
          account has been created. Accounts are only issued by invite after we&apos;ve spoken.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
        setStatus("sending");
        setError(null);
        try {
          await submit({
            data: {
              fullName: values["fullName"] ?? "",
              businessName: values["businessName"] ?? "",
              email: values["email"] ?? "",
              phone: values["phone"] ?? "",
              message: values["message"] ?? "",
            },
          });
          setStatus("sent");
        } catch (err) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Your name</span>
          <input name="fullName" required minLength={2} className={field} placeholder="Jordan Ellis" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Business name</span>
          <input
            name="businessName"
            required
            minLength={2}
            className={field}
            placeholder="Your business"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Email</span>
          <input
            name="email"
            type="email"
            required
            className={field}
            placeholder="you@yourbusiness.com"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-foreground">Phone</span>
          <input name="phone" className={field} placeholder="(555) 555-0100" />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="font-medium text-foreground">
          Anything we should know? <span className="text-muted-foreground">(optional)</span>
        </span>
        <textarea
          name="message"
          rows={4}
          className={field}
          placeholder="Tools you're juggling, what's breaking, roughly how many people on the team."
        />
      </label>

      {status === "error" && error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Request a discovery call"}
      </button>
      <p className="text-xs text-muted-foreground">
        We&apos;ll only use this to contact you about ERA. No newsletter, no account, no card.
      </p>
    </form>
  );
}
