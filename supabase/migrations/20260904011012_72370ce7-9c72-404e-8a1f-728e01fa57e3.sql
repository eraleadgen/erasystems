ALTER TABLE public.discovery_requests
  ADD COLUMN IF NOT EXISTS scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_event_id text;