import * as React from "react";
import {
  Body,
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

export interface DiscoveryRequestEmailProps {
  fullName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  businessType?: string;
  message?: string;
  submittedAt?: string;
  sourceHostname?: string;
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

function Field({ name, text }: { name: string; text: string }) {
  return (
    <Section>
      <Text style={label}>{name}</Text>
      <Text style={value}>{text}</Text>
    </Section>
  );
}

export function DiscoveryRequestEmail({
  fullName = "New prospect",
  businessName = "Unknown business",
  email = "unknown@example.com",
  phone,
  businessType,
  message,
  submittedAt,
  sourceHostname,
}: DiscoveryRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Discovery call request from ${fullName} at ${businessName}`}</Preview>
      <Body style={{ backgroundColor: "#f4f6f5", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            margin: "32px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Text style={{ ...label, color: "#0f766e" }}>ERA Systems</Text>
          <Heading style={{ fontSize: "22px", margin: "6px 0 20px", color: "#0f1a17" }}>
            New discovery call request
          </Heading>
          <Hr style={{ borderColor: "#e3e8e6", margin: "0 0 24px" }} />

          <Field name="Name" text={fullName} />
          <Field name="Business" text={businessName} />
          <Field name="Email" text={email} />
          {phone ? <Field name="Phone" text={phone} /> : null}
          {businessType ? <Field name="Business type" text={businessType} /> : null}
          {message ? <Field name="Notes" text={message} /> : null}
          {submittedAt ? <Field name="Submitted" text={submittedAt} /> : null}
          {sourceHostname ? <Field name="Source" text={sourceHostname} /> : null}

          <Hr style={{ borderColor: "#e3e8e6", margin: "8px 0 20px" }} />
          <Text style={{ fontSize: "13px", color: "#6b7a76", margin: 0 }}>
            Reply directly to this email to reach the prospect and schedule the call.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: DiscoveryRequestEmail,
  displayName: "Discovery call request",
  subject: (data: Record<string, any>) =>
    `Discovery call request: ${data["businessName"] ?? "New prospect"}`,
  to: "support@eraleadgen.com",
  previewData: {
    fullName: "Jordan Reyes",
    businessName: "Peak Auto Spa",
    email: "jordan@peakautospa.com",
    phone: "(404) 555-0142",
    businessType: "Mobile detailing",
    message: "Looking to automate booking and follow up.",
    submittedAt: "Sep 3, 2026, 12:20 AM UTC",
    sourceHostname: "eraleadgen.com",
  },
} satisfies TemplateEntry;
