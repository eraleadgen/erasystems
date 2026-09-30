import * as React from "react";
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

export interface AccountAlertEmailProps {
  title?: string;
  businessName?: string;
  summary?: string;
  details?: { label: string; value: string }[];
  profileUrl?: string;
}

const label: React.CSSProperties = {
  margin: "0",
  fontSize: "12px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7c8a86",
};

export function AccountAlertEmail({
  title = "Client account update",
  businessName = "A client",
  summary,
  details = [],
  profileUrl,
}: AccountAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${title}: ${businessName}`}</Preview>
      <Body style={{ backgroundColor: "#f4f6f5", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "12px", margin: "32px auto", maxWidth: "560px", padding: "32px" }}>
          <Text style={{ ...label, color: "#0f766e" }}>ERA Systems</Text>
          <Heading style={{ fontSize: "22px", margin: "6px 0 8px", color: "#0f1a17" }}>{title}</Heading>
          <Text style={{ fontSize: "15px", color: "#0f1a17", margin: "0 0 20px" }}>{businessName}</Text>
          {summary ? <Text style={{ fontSize: "15px", color: "#33413d", margin: "0 0 20px" }}>{summary}</Text> : null}
          <Hr style={{ borderColor: "#e3e8e6", margin: "0 0 20px" }} />
          {details.map((d) => (
            <Section key={d.label}>
              <Text style={label}>{d.label}</Text>
              <Text style={{ margin: "0 0 14px", fontSize: "15px", color: "#0f1a17" }}>{d.value}</Text>
            </Section>
          ))}
          {profileUrl ? (
            <Button href={profileUrl} style={{ backgroundColor: "#0f766e", color: "#ffffff", borderRadius: "8px", padding: "12px 18px", fontSize: "14px" }}>
              Open client in agency console
            </Button>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: AccountAlertEmail,
  displayName: "Client account alert (internal)",
  subject: (data: Record<string, any>) => `${data["title"] ?? "Client update"}: ${data["businessName"] ?? "Client"}`,
  to: "support@eraleadgen.com",
  previewData: {
    title: "Plan change scheduled",
    businessName: "Peak Auto Spa",
    summary: "The client scheduled a downgrade from Growth to Basic.",
    details: [{ label: "Takes effect", value: "Oct 31, 2026" }],
    profileUrl: "https://www.eraleadgen.com/admin/clients/abc",
  },
} satisfies TemplateEntry;
