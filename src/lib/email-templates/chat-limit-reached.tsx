import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

export interface ChatLimitReachedProps {
  businessName?: string;
  messages?: number;
  resetsAt?: string;
}

const main: React.CSSProperties = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container: React.CSSProperties = { padding: "24px 28px", maxWidth: "560px" };
const text: React.CSSProperties = { fontSize: "15px", color: "#0f1a17", lineHeight: "1.6" };

export function ChatLimitReachedEmail({
  businessName = "Your business",
  messages = 0,
  resetsAt = "midnight UTC tonight",
}: ChatLimitReachedProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${businessName}: website assistant paused for today`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ fontSize: "20px", color: "#0f1a17" }}>
            Website assistant paused for today
          </Heading>
          <Text style={text}>
            The chat assistant on {businessName}&apos;s website has answered {messages} messages
            today and has reached its daily allowance, so it will stop replying until it resets at{" "}
            {resetsAt}.
          </Text>
          <Text style={text}>
            Visitors still see the phone number, email and booking form on the site — the assistant
            tells them to get in touch directly. If this is happening often, reply to this email and
            we&apos;ll raise the allowance.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ChatLimitReachedEmail,
  subject: "Website assistant paused for today",
  displayName: "Chat assistant daily limit reached",
  previewData: { businessName: "Bloom Lane Florals", messages: 300, resetsAt: "midnight UTC tonight" },
} satisfies TemplateEntry;
