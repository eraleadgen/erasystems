import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

export interface TierPurchasedEmailProps {
  businessName?: string;
  legalName?: string;
  slug?: string;
  planTier?: string;
  amount?: string;
  addons?: string;
  ownerEmail?: string;
  ownerName?: string;
  supportPhone?: string;
  timezone?: string;
  serviceCount?: string;
  paidAt?: string;
  profileUrl?: string;
}

const label: React.CSSProperties = {
  margin: "0",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7c8a86",
};

const value: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "15px",
  color: "#0f1a17",
};

function Field({ name, text }: { name: string; text?: string }) {
  if (!text) return null;
  return (
    <Section>
      <Text style={label}>{name}</Text>
      <Text style={value}>{text}</Text>
    </Section>
  );
}

export function TierPurchasedEmail({
  businessName = "A new client",
  legalName,
  slug,
  planTier,
  amount,
  addons,
  ownerEmail,
  ownerName,
  supportPhone,
  timezone,
  serviceCount,
  paidAt,
  profileUrl,
}: TierPurchasedEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${businessName} purchased the ${planTier ?? ""} tier`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Container style={{ padding: "28px 28px 36px", maxWidth: "600px" }}>
          <Text style={label}>ERA Systems</Text>
          <Heading style={{ margin: "6px 0 4px", fontSize: "22px", color: "#0f1a17" }}>
            {businessName} is paid and ready to provision
          </Heading>
          <Text style={{ margin: "0 0 22px", fontSize: "14px", color: "#4c5b57" }}>
            Payment cleared both verification checks and the account is now active. Finish the
            build: domain, A2P registration if AI agents apply, customer website, and the final
            overview.
          </Text>

          {profileUrl && (
            <Section style={{ margin: "0 0 26px" }}>
              <Button
                href={profileUrl}
                style={{
                  backgroundColor: "#0f6b57",
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Open their client profile
              </Button>
            </Section>
          )}

          <Hr style={{ borderColor: "#e3e9e7", margin: "0 0 22px" }} />

          <Field name="Purchased tier" text={planTier} />
          <Field name="Amount paid" text={amount} />
          <Field name="Add-ons" text={addons} />
          <Field name="Business" text={businessName} />
          <Field name="Legal name" text={legalName} />
          <Field name="Web address" text={slug} />
          <Field name="Owner" text={ownerName} />
          <Field name="Owner email" text={ownerEmail} />
          <Field name="Phone" text={supportPhone} />
          <Field name="Timezone" text={timezone} />
          <Field name="Services in catalog" text={serviceCount} />
          <Field name="Paid at" text={paidAt} />
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: TierPurchasedEmail,
  subject: (data: Record<string, unknown>) =>
    `New purchase: ${String(data["businessName"] ?? "client")} — ${String(data["planTier"] ?? "plan")}`,
  displayName: "Tier purchased (internal)",
  to: "support@eraleadgen.com",
  previewData: {
    businessName: "VDS",
    legalName: "Vinny's Detailing Services LLC",
    slug: "vds",
    planTier: "Enterprise",
    amount: "$4,000",
    addons: "Downloadable Apps",
    ownerEmail: "owner@example.com",
    ownerName: "Owner",
    timezone: "America/New_York",
    serviceCount: "6",
    paidAt: "September 3, 2026",
    profileUrl: "https://www.eraleadgen.com/admin/clients/00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;
