# ERA Systems

**Live:** [eraleadgen.com](https://eraleadgen.com)

ERA Systems is a multi-tenant SaaS platform that gives local service businesses one system for their website, AI chat, scheduling, customers, jobs and payments. Each client business gets its own branded public site on its own domain, plus a private portal to run the business.

## Highlights

- **Multi-tenant isolation:** every record carries a `business_id`, and Postgres Row-Level Security policies enforce separation in the database, not just in the app. Two live custom domains were tested side by side for cross-tenant leaks.
- **Hostname-based tenant resolution:** the server resolves the business from the incoming domain before rendering. Forged forwarding headers are ignored, and unknown domains return 404.
- **Invite-only onboarding:** single-use hashed invite tokens, a resumable onboarding wizard and an inactive-until-paid account lifecycle.
- **Stripe subscriptions:** custom quotes (setup fee plus recurring price), signature-verified webhooks, idempotent activation and end-of-period plan changes and cancellations.
- **Tiered entitlements:** Basic, Growth and Enterprise tiers, with add-ons that are never granted implicitly. All entitlement checks run on the server.
- **AI chat grounded in live tenant data:** answers come only from the business's real catalog, pricing and availability, with daily usage limits.
- **Automated customer emails:** booking confirmations, day-before reminders and review requests, sent by scheduled jobs with idempotency.
- **Security:** email-code device verification with a 30-day remembered device, enforced on the server; elevated database access limited to an audited, documented register.
- **Analytics:** monthly statements built from one shared calculation, downloadable as PDF.

## Tech stack

TanStack Start (React 19, SSR, server functions), TypeScript, Vite, Tailwind CSS v4, Postgres with RLS, Stripe, scheduled jobs with pg_cron and transactional email. Deployed on edge (Cloudflare Workers) infrastructure.

## Project structure

- `src/routes`: pages, the agency console, the client portal and API/webhook endpoints
- `src/lib`: server functions, pricing, entitlements, billing and tenant resolution
- `src/components`: marketing site, tenant sites and portal UI
- `supabase/`: database migrations, including RLS policies
- `docs/elevated-access.md`: register of privileged database access

## Local development

```sh
git clone https://github.com/eraleadgen/erasystems.git
cd erasystems
npm i
npm run dev
```

Built with [Lovable](https://lovable.dev).
