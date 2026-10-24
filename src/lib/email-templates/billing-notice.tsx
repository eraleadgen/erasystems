import * as React from "react";
import { Button, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, muted } from "./customer-shell";

export interface BillingNoticeProps {
  businessName?: string;
  /** payment_failed = card declined, grace period running; suspended = service paused. */
  kind?: "payment_failed" | "suspended";
  graceEnds?: string;
  manageUrl?: string;
}

export function BillingNoticeEmail({
  businessName = "your business",
  kind = "payment_failed",
  graceEnds = "",
  manageUrl = "https://www.eraleadgen.com/billing",
}: BillingNoticeProps) {
  const failed = kind === "payment_failed";
  return (
    <CustomerEmailShell
      businessName="ERA Systems"
      accent="#0f766e"
      preview={failed ? "We couldn't process your ERA payment" : "Your ERA service is paused"}
      heading={failed ? "Your payment didn't go through" : "Your ERA service is paused"}
      footer={
        <Text style={muted}>
          This secure Stripe link expires soon. You can always open a new one from the Billing page in your ERA
          portal, or reply to this email for help.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 18px" }}>
        {failed
          ? `We couldn't charge the card on file for ${businessName}. Please update your payment method${
              graceEnds ? ` by ${graceEnds}` : ""
            } to keep your website, booking and chat running.`
          : `We haven't received payment for ${businessName}, so your website, booking and chat are paused. Pay your balance and everything turns back on automatically.`}
      </Text>
      <Button
        href={manageUrl}
        style={{
          backgroundColor: "#0f766e",
          borderRadius: "8px",
          color: "#ffffff",
          display: "inline-block",
          fontSize: "14px",
          fontWeight: 600,
          padding: "12px 20px",
          textDecoration: "none",
        }}
      >
        Update payment method
      </Button>
    </CustomerEmailShell>
  );
}

export const template = {
  component: BillingNoticeEmail,
  subject: (d: Record<string, any>) =>
    d["kind"] === "suspended" ? "Your ERA service is paused" : "Action needed: update your payment method",
  displayName: "Billing notice",
  previewData: { businessName: "Harborline Dental", kind: "payment_failed", graceEnds: "November 2, 2026" },
} satisfies TemplateEntry;
