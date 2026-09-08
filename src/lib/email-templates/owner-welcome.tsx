import * as React from "react";
import { Button, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, Field, muted } from "./customer-shell";

export interface OwnerWelcomeProps {
  businessName?: string;
  ownerName?: string;
  planTier?: string;
  dashboardUrl?: string;
}

export function OwnerWelcomeEmail({
  businessName = "your business",
  ownerName = "there",
  planTier = "",
  dashboardUrl = "https://www.eraleadgen.com/dashboard",
}: OwnerWelcomeProps) {
  return (
    <CustomerEmailShell
      businessName="ERA Systems"
      accent="#0f766e"
      preview={`${businessName} is live on ERA`}
      heading={`${businessName} is live`}
      footer={
        <Text style={muted}>
          Questions at any point? Reply to this email and a real person at ERA will answer.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 20px" }}>
        Hi {ownerName}, your payment is through and {businessName} is now active on ERA. Your admin
        dashboard, catalog, booking flow and AI chat widget are switched on.
      </Text>
      {planTier ? <Field name="Plan" text={planTier} /> : null}
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 18px" }}>
        Next: check your services and pricing, set your hours, and add your team. We'll be in touch
        to walk the rest of the go-live checklist with you.
      </Text>
      <Button
        href={dashboardUrl}
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
        Open your dashboard
      </Button>
    </CustomerEmailShell>
  );
}

export const template = {
  component: OwnerWelcomeEmail,
  displayName: "Welcome (business owner)",
  subject: (data: Record<string, any>) => `${data["businessName"] ?? "Your business"} is live on ERA`,
  previewData: {
    businessName: "Bloom Lane Florals",
    ownerName: "Alex",
    planTier: "Basic",
    dashboardUrl: "https://www.eraleadgen.com/dashboard",
  },
} satisfies TemplateEntry;
