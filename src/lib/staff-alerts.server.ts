/**
 * Internal alerts to support@eraleadgen.com about major client account events
 * (new sign-ups, plan changes, cancellations, AI agent choices). Never throws:
 * a failed alert must never fail the client's action.
 */
export interface StaffAlert {
  title: string;
  businessId: string;
  businessName: string;
  summary: string;
  details?: { label: string; value: string }[];
  /** Stable key so retries of the same event don't send twice. */
  idempotencyKey: string;
  replyTo?: string | undefined;
  /** Overrides the default agency-console link. */
  url?: string;
}

export async function sendStaffAlert(alert: StaffAlert): Promise<void> {
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("account-alert", "support@eraleadgen.com", {
      idempotencyKey: alert.idempotencyKey,
      ...(alert.replyTo ? { replyTo: alert.replyTo } : {}),
      templateData: {
        title: alert.title,
        businessName: alert.businessName,
        summary: alert.summary,
        details: alert.details ?? [],
        profileUrl: alert.url ?? `https://www.eraleadgen.com/admin/clients/${alert.businessId}`,
      },
    });
  } catch (error) {
    console.error("staff alert failed", error instanceof Error ? error.message : error);
  }
}
