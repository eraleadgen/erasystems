import * as React from "react";
import { Text } from "@react-email/components";

import type { TemplateEntry } from "./registry";
import { CustomerEmailShell, Field, muted } from "./customer-shell";

export interface AppointmentReminderProps {
  businessName?: string;
  accent?: string;
  customerName?: string;
  when?: string;
  services?: string;
  address?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export function AppointmentReminderEmail({
  businessName = "Your appointment",
  accent = "#0f766e",
  customerName = "there",
  when = "",
  services = "",
  address = "",
  supportEmail = "",
  supportPhone = "",
}: AppointmentReminderProps) {
  return (
    <CustomerEmailShell
      businessName={businessName}
      accent={accent}
      preview={`Reminder: your appointment with ${businessName}${when ? ` on ${when}` : ""}`}
      heading="A reminder about tomorrow"
      footer={
        <Text style={muted}>
          Need to move it? Reply to this email
          {supportEmail ? ` or contact ${supportEmail}` : ""}
          {supportPhone ? `, or call ${supportPhone}` : ""}.
        </Text>
      }
    >
      <Text style={{ fontSize: "15px", color: "#141a19", margin: "0 0 20px" }}>
        Hi {customerName}, this is a quick reminder of your appointment with {businessName}.
      </Text>
      {when ? <Field name="When" text={when} /> : null}
      {services ? <Field name="Services" text={services} /> : null}
      {address ? <Field name="Address" text={address} /> : null}
    </CustomerEmailShell>
  );
}

export const template = {
  component: AppointmentReminderEmail,
  displayName: "Appointment reminder (customer)",
  subject: (data: Record<string, any>) =>
    `Reminder: ${data["businessName"] ?? "your appointment"}${data["when"] ? ` — ${data["when"]}` : ""}`,
  previewData: {
    businessName: "Bloom Lane Florals",
    accent: "#0f766e",
    customerName: "Alex",
    when: "Tomorrow, Sep 11, 2026 at 10:00 AM EDT",
    services: "Seasonal bouquet, Delivery",
  },
} satisfies TemplateEntry;
