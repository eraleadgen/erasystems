import * as React from "react";
import { Button, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, muted } from "./customer-shell";

export interface ReviewRequestProps {
  businessName?: string;
  accent?: string;
  customerName?: string;
  services?: string;
  reviewUrl?: string;
  supportEmail?: string;
}

export function ReviewRequestEmail({
  businessName = "Your recent visit",
  accent = "#0f766e",
  customerName = "there",
  services = "",
  reviewUrl = "",
  supportEmail = "",
}: ReviewRequestProps) {
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : "#0f766e";
  return (
    <CustomerEmailShell
      businessName={businessName}
      accent={accent}
      preview={`How did we do? A quick word from ${businessName}`}
      heading="How did we do?"
      footer={
        <Text style={muted}>
          If something wasn't right, reply to this email
          {supportEmail ? ` or contact ${supportEmail}` : ""} and we'll put it right.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 16px" }}>
        Hi {customerName}, thanks for choosing {businessName}
        {services ? ` for ${services}` : ""}. If you have a moment, we'd really appreciate a short
        review — it helps other local customers find us.
      </Text>
      {reviewUrl ? (
        <Button
          href={reviewUrl}
          style={{
            backgroundColor: safeAccent,
            borderRadius: "8px",
            color: "#ffffff",
            display: "inline-block",
            fontSize: "14px",
            fontWeight: 600,
            padding: "12px 20px",
            textDecoration: "none",
          }}
        >
          Leave a review
        </Button>
      ) : (
        <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 8px" }}>
          Just reply to this email with a sentence or two — it means a lot.
        </Text>
      )}
    </CustomerEmailShell>
  );
}

export const template = {
  component: ReviewRequestEmail,
  displayName: "Review request (customer)",
  subject: (data: Record<string, any>) => `How did we do? — ${data["businessName"] ?? "Thanks again"}`,
  previewData: {
    businessName: "Bloom Lane Florals",
    accent: "#0f766e",
    customerName: "Alex",
    services: "Seasonal bouquet",
    reviewUrl: "https://bloomlane.com",
  },
} satisfies TemplateEntry;
