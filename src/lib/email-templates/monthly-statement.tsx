import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

export interface MonthlyStatementProps {
  businessName?: string;
  monthLabel?: string;
  revenue?: string;
  completedJobs?: number;
  averageTicket?: string;
  changeLabel?: string;
  repeatRate?: string;
  newCustomers?: number;
  topServices?: { name: string; revenue: string; jobs: number }[];
  statementUrl?: string;
}

const main: React.CSSProperties = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container: React.CSSProperties = { padding: "24px 28px", maxWidth: "600px" };
const text: React.CSSProperties = { fontSize: "15px", color: "#0f1a17", lineHeight: "1.6" };
const small: React.CSSProperties = { fontSize: "13px", color: "#4b5b56", lineHeight: "1.6" };
const figureLabel: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#4b5b56",
  margin: "0",
};
const figureValue: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#0f1a17",
  margin: "2px 0 14px",
};

export function MonthlyStatementEmail({
  businessName = "Your business",
  monthLabel = "Last month",
  revenue = "$0",
  completedJobs = 0,
  averageTicket = "$0",
  changeLabel = "",
  repeatRate = "—",
  newCustomers = 0,
  topServices = [],
  statementUrl,
}: MonthlyStatementProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${monthLabel}: ${revenue} from ${completedJobs} completed jobs`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={figureLabel}>Monthly statement</Text>
          <Heading style={{ fontSize: "21px", color: "#0f1a17", margin: "4px 0 2px" }}>
            {businessName} — {monthLabel}
          </Heading>
          <Text style={small}>
            Completed work only. Cancelled and no-show jobs are excluded.
          </Text>

          <Hr style={{ borderColor: "#e3e8e6", margin: "18px 0" }} />

          <Text style={figureLabel}>Revenue</Text>
          <Text style={figureValue}>
            {revenue}
            {changeLabel ? ` (${changeLabel})` : ""}
          </Text>

          <Text style={figureLabel}>Completed jobs</Text>
          <Text style={figureValue}>
            {completedJobs} · average ticket {averageTicket}
          </Text>

          <Text style={figureLabel}>Customers</Text>
          <Text style={figureValue}>
            {newCustomers} new · {repeatRate} repeat rate
          </Text>

          {topServices.length > 0 && (
            <>
              <Hr style={{ borderColor: "#e3e8e6", margin: "4px 0 16px" }} />
              <Text style={{ ...figureLabel, marginBottom: "6px" }}>Top services</Text>
              {topServices.map((s) => (
                <Text key={s.name} style={{ ...text, margin: "0 0 4px" }}>
                  {s.name} — {s.revenue} across {s.jobs} job{s.jobs === 1 ? "" : "s"}
                </Text>
              ))}
            </>
          )}

          {statementUrl && (
            <Text style={{ ...text, marginTop: "18px" }}>
              Open the full one-page statement (day-by-day revenue, customer value, every
              service): {statementUrl}
            </Text>
          )}

          <Hr style={{ borderColor: "#e3e8e6", margin: "18px 0" }} />
          <Text style={small}>
            Figures come from the same calculation as your Analytics tab and are produced from
            live booking data at the moment this email was sent. Per-hour and per-service figures
            are earnings, not profit margin.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: MonthlyStatementEmail,
  subject: (data: Record<string, any>) =>
    `${data['monthLabel'] ?? "Monthly"} statement — ${data['businessName'] ?? "your business"}`,
  displayName: "Monthly statement",
  previewData: {
    businessName: "ERA Systems",
    monthLabel: "August 2026",
    revenue: "$4,200",
    completedJobs: 14,
    averageTicket: "$300",
    changeLabel: "+12% vs prior month",
    repeatRate: "38%",
    newCustomers: 6,
    topServices: [
      { name: "Full detail", revenue: "$2,400", jobs: 8 },
      { name: "Interior only", revenue: "$1,800", jobs: 6 },
    ],
    statementUrl: "https://erasystems.lovable.app/statement/2026-08",
  },
} satisfies TemplateEntry;
