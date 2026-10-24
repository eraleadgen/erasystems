ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS subscription_price_cents integer,
  ADD COLUMN IF NOT EXISTS setup_fee_cents integer,
  ADD COLUMN IF NOT EXISTS billing_interval text;
COMMENT ON COLUMN public.payments.plan_tier IS 'Tier the checkout session was created for; activation refuses if the business tier changed.';
COMMENT ON COLUMN public.payments.status IS 'pending | paid | failed | needs_review (tier or terms changed between checkout and payment).';
CREATE INDEX IF NOT EXISTS payments_business_pending_idx ON public.payments (business_id) WHERE status = 'pending';