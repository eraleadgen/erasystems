import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export interface ClientDeliveryRequestProps {
  businessName: string;
  heading: string;
  body: string;
}

export function ClientDeliveryRequest({
  businessName = "your business",
  heading = "ERA setup",
  body = "",
}: ClientDeliveryRequestProps) {
  return (
    <Html>
      <Head />
      <Preview>{heading}</Preview>
      <Body style={{ backgroundColor: "#0b0f0e", fontFamily: "Arial, sans-serif", margin: 0 }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 24px" }}>
          <Heading style={{ color: "#ffffff", fontSize: "22px", margin: "0 0 16px" }}>
            {heading}
          </Heading>
          <Section>
            <Text style={{ color: "#cfd8d5", fontSize: "15px", lineHeight: "24px" }}>{body}</Text>
            <Text style={{ color: "#8b9a96", fontSize: "13px", lineHeight: "20px" }}>
              {businessName} · ERA Systems · support@eraleadgen.com
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: ClientDeliveryRequest,
  subject: (data: Record<string, any>) => data['heading'] ?? "ERA setup",
  displayName: "Client delivery request",
  previewData: {
    businessName: "Valley Detailing",
    heading: "ERA setup: your logo and brand files",
    body: "Send over your logo files and brand colors.",
  },
};
