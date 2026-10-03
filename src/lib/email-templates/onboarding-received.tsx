import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

export function OnboardingReceivedEmail({
  name = "there",
  businessName = "your business",
  portalUrl = "https://eraleadgen.com/dashboard",
}: { name?: string; businessName?: string; portalUrl?: string }) {
  return (
    <Html>
      <Head />
      <Preview>{`We've got your details for ${businessName}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ margin: "32px auto", maxWidth: "560px", padding: "32px", border: "1px solid #e3e8e6", borderRadius: "12px" }}>
          <Text style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e" }}>ERA Systems</Text>
          <Heading style={{ fontSize: "22px", color: "#0f1a17", margin: "6px 0 12px" }}>Thanks, {name}. Your setup is in.</Heading>
          <Text style={{ fontSize: "15px", color: "#33413d" }}>
            We've received everything you entered for {businessName}. Next, open your client portal to review your profile, choose your portal theme and complete your subscription payment to activate your account.
          </Text>
          <Text style={{ fontSize: "15px", color: "#33413d" }}>
            Once your payment is received, our team will have your account set up and live within 7 days.
          </Text>
          <Button href={portalUrl} style={{ backgroundColor: "#0f766e", color: "#ffffff", borderRadius: "8px", padding: "12px 18px", fontSize: "14px" }}>
            Open your client portal
          </Button>
          <Text style={{ fontSize: "13px", color: "#7c8a86", marginTop: "24px" }}>Questions? Reply to this email or write to support@eraleadgen.com.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: OnboardingReceivedEmail,
  displayName: "Onboarding received (client)",
  subject: (d: Record<string, any>) => `We've received your setup for ${d["businessName"] ?? "your business"}`,
  previewData: { name: "Jordan", businessName: "Peak Auto Spa", portalUrl: "https://eraleadgen.com/dashboard" },
} satisfies TemplateEntry;
