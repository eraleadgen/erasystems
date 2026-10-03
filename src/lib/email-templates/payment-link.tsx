import * as React from "react";
import { Button, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, muted } from "./customer-shell";

export interface PaymentLinkProps {
  businessName?: string;
  payUrl?: string;
  recurring?: string;
  firstCharge?: string;
}

export function PaymentLinkEmail({
  businessName = "your business",
  payUrl = "https://eraleadgen.com",
  recurring = "",
  firstCharge = "",
}: PaymentLinkProps) {
  return (
    <CustomerEmailShell
      businessName="ERA Systems"
      accent="#0f766e"
      preview="Set up automatic payments for your ERA plan"
      heading="Set up automatic payments"
      footer={<Text style={muted}>This secure Stripe link works for 24 hours. Reply if you need a new one.</Text>}
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 18px" }}>
        We're moving {businessName} onto automatic payments through Stripe so you never have to pay by hand.
      </Text>
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 20px" }}>
        Amount: <strong>{recurring}</strong>
        {firstCharge ? ` · first charge on ${firstCharge}. Nothing is charged today.` : ""}
      </Text>
      <Button
        href={payUrl}
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
        Set up payments with Stripe
      </Button>
    </CustomerEmailShell>
  );
}

export const template = {
  component: PaymentLinkEmail,
  subject: "Set up automatic payments for your ERA plan",
  displayName: "Subscription payment link",
  previewData: { businessName: "Bloom Lane", payUrl: "https://checkout.stripe.com", recurring: "$499.00 monthly", firstCharge: "November 3, 2026" },
} satisfies TemplateEntry;
