import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

interface Props {
  fullName?: string;
  businessName?: string;
}

export function DiscoveryConfirmationEmail({ fullName, businessName }: Props) {
  const first = fullName?.trim().split(/\s+/)[0] || "there";
  return (
    <Html lang="en">
      <Head />
      <Preview>We got your discovery call request. An ERA team member will reach out soon.</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ margin: "32px auto", maxWidth: "560px", padding: "32px" }}>
          <Text style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e" }}>
            ERA Systems
          </Text>
          <Heading style={{ fontSize: "22px", margin: "6px 0 20px", color: "#0f1a17" }}>
            Thanks, {first}. We&apos;ve got your request.
          </Heading>
          <Hr style={{ borderColor: "#e3e8e6", margin: "0 0 20px" }} />
          <Text style={{ fontSize: "15px", color: "#0f1a17", lineHeight: "24px" }}>
            We received your discovery call request{businessName ? ` for ${businessName}` : ""}. A
            member of the ERA team will reach out to you by email shortly to find a time that works.
          </Text>
          <Text style={{ fontSize: "15px", color: "#0f1a17", lineHeight: "24px" }}>
            There&apos;s nothing else you need to do for now. If you have questions in the meantime,
            just reply to this email or write to support@eraleadgen.com.
          </Text>
          <Text style={{ fontSize: "13px", color: "#6b7a76", marginTop: "24px" }}>— The ERA Systems team</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: DiscoveryConfirmationEmail,
  displayName: "Discovery call confirmation (prospect)",
  subject: "We received your discovery call request",
  previewData: { fullName: "Jordan Reyes", businessName: "Peak Auto Spa" },
} satisfies TemplateEntry;
