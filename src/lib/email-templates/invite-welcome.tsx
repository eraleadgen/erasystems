import * as React from "react";
import { Button, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, muted } from "./customer-shell";

export interface InviteWelcomeProps {
  fullName?: string;
  registerUrl?: string;
  expiresOn?: string;
  setupFee?: string;
  recurring?: string;
  payUrl?: string;
}

export function InviteWelcomeEmail({
  fullName = "there",
  registerUrl = "https://www.eraleadgen.com/register",
  expiresOn = "",
  setupFee = "",
  recurring = "",
  payUrl = "https://www.eraleadgen.com/dashboard",
}: InviteWelcomeProps) {
  return (
    <CustomerEmailShell
      businessName="ERA Systems"
      accent="#0f766e"
      preview="Your ERA Systems invitation"
      heading="Welcome to ERA Systems"
      footer={
        <Text style={muted}>
          This link is personal to you and can only be used once. Reply to this email and a real
          person at ERA will answer.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 18px" }}>
        Hi {fullName}, thanks for the call. Your ERA account is ready to be created.
      </Text>
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 20px" }}>
        Use the button below to set your password and walk through the short setup wizard: your
        business details, branding, services and team. It takes about ten minutes and you can stop
        and come back to it at any point.
      </Text>
      <Button
        href={registerUrl}
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
        Create account and pay with Stripe
      </Button>
      {recurring ? (
        <Text style={{ fontSize: "15px", color: "#141a19", margin: "22px 0 6px" }}>
          <strong>Your quote</strong>
          <br />
          {setupFee ? <>One-time setup fee: {setupFee}<br /></> : null}
          Recurring: {recurring}
        </Text>
      ) : null}
      {recurring ? (
        <Text style={{ ...muted, margin: "0 0 0" }}>
          After the setup wizard you'll pay these exact amounts securely through Stripe. The setup
          fee is charged once; the recurring amount renews automatically. Already set up your
          account? <a href={payUrl}>Pay here</a>.
        </Text>
      ) : null}
      {expiresOn ? (
        <Text style={{ ...muted, margin: "20px 0 0" }}>This invitation expires {expiresOn}.</Text>
      ) : null}
    </CustomerEmailShell>
  );
}

export const template = {
  component: InviteWelcomeEmail,
  subject: "Your ERA Systems invitation",
  displayName: "Client invitation",
  previewData: {
    fullName: "Dana",
    registerUrl: "https://www.eraleadgen.com/register?token=example",
    expiresOn: "September 18, 2026",
    setupFee: "$2,000.00",
    recurring: "$499.00 monthly",
  },
} satisfies TemplateEntry;
