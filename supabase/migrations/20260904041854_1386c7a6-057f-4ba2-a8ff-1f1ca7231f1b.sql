ALTER TABLE public.client_delivery_tasks
  ADD COLUMN IF NOT EXISTS is_override boolean NOT NULL DEFAULT false;