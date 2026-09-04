CREATE TABLE IF NOT EXISTS public.client_delivery_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  task_key text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  owner text NOT NULL DEFAULT 'era',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_delivery_tasks_status_check CHECK (status IN ('not_started','in_progress','blocked','done')),
  CONSTRAINT client_delivery_tasks_owner_check CHECK (owner IN ('era','client')),
  CONSTRAINT client_delivery_tasks_unique UNIQUE (business_id, task_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_delivery_tasks TO authenticated;
GRANT ALL ON public.client_delivery_tasks TO service_role;

ALTER TABLE public.client_delivery_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform staff read delivery tasks" ON public.client_delivery_tasks;
CREATE POLICY "Platform staff read delivery tasks"
  ON public.client_delivery_tasks FOR SELECT TO authenticated
  USING (private.is_platform_staff());

DROP POLICY IF EXISTS "Platform staff insert delivery tasks" ON public.client_delivery_tasks;
CREATE POLICY "Platform staff insert delivery tasks"
  ON public.client_delivery_tasks FOR INSERT TO authenticated
  WITH CHECK (private.is_platform_staff());

DROP POLICY IF EXISTS "Platform staff update delivery tasks" ON public.client_delivery_tasks;
CREATE POLICY "Platform staff update delivery tasks"
  ON public.client_delivery_tasks FOR UPDATE TO authenticated
  USING (private.is_platform_staff()) WITH CHECK (private.is_platform_staff());

DROP POLICY IF EXISTS "Platform staff delete delivery tasks" ON public.client_delivery_tasks;
CREATE POLICY "Platform staff delete delivery tasks"
  ON public.client_delivery_tasks FOR DELETE TO authenticated
  USING (private.is_platform_staff());

DROP TRIGGER IF EXISTS client_delivery_tasks_updated_at ON public.client_delivery_tasks;
CREATE TRIGGER client_delivery_tasks_updated_at
  BEFORE UPDATE ON public.client_delivery_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();