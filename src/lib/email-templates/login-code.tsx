import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";

export function LoginCodeEmail({ code = "000000" }: { code?: string }) {
  return (
    <Html>
      <Head />
      <Preview>{`Your ERA Systems code: ${code}`}</Preview>
      <Body style={{ backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ margin: "32px auto", maxWidth: "480px", padding: "32px", border: "1px solid #e3e8e6", borderRadius: "12px" }}>
          <Text style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f766e" }}>ERA Systems</Text>
          <Heading style={{ fontSize: "22px", color: "#0f1a17", margin: "6px 0 12px" }}>Your verification code</Heading>
          <Text style={{ fontSize: "15px", color: "#33413d" }}>Enter this code to finish signing in on a new device. It expires in 10 minutes.</Text>
          <Text style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "0.3em", color: "#0f1a17", margin: "20px 0" }}>{code}</Text>
          <Text style={{ fontSize: "13px", color: "#7c8a86" }}>If you didn't try to sign in, ignore this email and contact support@eraleadgen.com.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: LoginCodeEmail,
  displayName: "Sign-in verification code",
  subject: "Your ERA Systems verification code",
  previewData: { code: "482913" },
} satisfies TemplateEntry;
