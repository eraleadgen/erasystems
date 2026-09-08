import * as React from "react";
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";

/**
 * Shared frame for emails a tenant sends to its own customers.
 * Neutral white body with a single tenant accent colour, so one template
 * works for any business without per-client code.
 */

export const muted: React.CSSProperties = {
  margin: "0 0 6px",
  fontSize: "13px",
  color: "#6b7a76",
};

export const label: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#8a9793",
};

export const value: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "15px",
  color: "#141a19",
};

export function Field({ name, text }: { name: string; text: string }) {
  return (
    <Section>
      <Text style={label}>{name}</Text>
      <Text style={value}>{text}</Text>
    </Section>
  );
}

export function CustomerEmailShell({
  businessName,
  accent,
  preview,
  heading,
  children,
  footer,
}: {
  businessName: string;
  accent: string;
  preview: string;
  heading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const safeAccent = /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : "#0f766e";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e6ebea",
            borderRadius: "12px",
            margin: "32px auto",
            maxWidth: "560px",
            padding: "32px",
          }}
        >
          <Text style={{ ...label, color: safeAccent, fontWeight: 700 }}>{businessName}</Text>
          <Heading style={{ fontSize: "22px", margin: "6px 0 18px", color: "#141a19" }}>{heading}</Heading>
          <Hr style={{ borderColor: "#e6ebea", margin: "0 0 22px" }} />
          {children}
          {footer ? (
            <>
              <Hr style={{ borderColor: "#e6ebea", margin: "8px 0 18px" }} />
              {footer}
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
