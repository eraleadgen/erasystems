import * as React from "react";
import { Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, Field, muted } from "./customer-shell";

export interface BookingConfirmationProps {
  businessName?: string;
  accent?: string;
  customerName?: string;
  when?: string;
  services?: string;
  total?: string;
  durationLabel?: string;
  address?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export function BookingConfirmationEmail({
  businessName = "Your booking",
  accent = "#0f766e",
  customerName = "there",
  when = "",
  services = "",
  total = "",
  durationLabel = "",
  address = "",
  supportEmail = "",
  supportPhone = "",
}: BookingConfirmationProps) {
  return (
    <CustomerEmailShell
      businessName={businessName}
      accent={accent}
      preview={`Your booking with ${businessName}${when ? ` on ${when}` : ""}`}
      heading="We've got your booking"
      footer={
        <Text style={muted}>
          Need to change or cancel? Reply to this email
          {supportEmail ? ` or contact ${supportEmail}` : ""}
          {supportPhone ? `, or call ${supportPhone}` : ""}.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 20px" }}>
        Hi {customerName}, thanks for booking with {businessName}. Here are the details we have.
      </Text>
      {when ? <Field name="When" text={when} /> : null}
      {services ? <Field name="Services" text={services} /> : null}
      {durationLabel ? <Field name="Estimated time" text={durationLabel} /> : null}
      {total ? <Field name="Estimated total" text={total} /> : null}
      {address ? <Field name="Address" text={address} /> : null}
      <Text style={muted}>
        This request is booked in. {businessName} will be in touch if anything needs confirming.
      </Text>
    </CustomerEmailShell>
  );
}

export const template = {
  component: BookingConfirmationEmail,
  displayName: "Booking confirmation (customer)",
  subject: (data: Record<string, any>) =>
    `Booking confirmed${data["when"] ? ` — ${data["when"]}` : ""}`,
  previewData: {
    businessName: "Bloom Lane Florals",
    accent: "#0f766e",
    customerName: "Alex",
    when: "Friday, Sep 11, 2026 at 10:00 AM EDT",
    services: "Seasonal bouquet, Delivery",
    durationLabel: "1 hr 30 min",
    total: "$245.00",
    supportEmail: "hello@bloomlane.com",
    supportPhone: "(404) 555-0142",
  },
} satisfies TemplateEntry;
