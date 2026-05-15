-- Keep events.enrolled_count in sync with event_enrollments.
-- Supabase/Postgres triggers run on the database side, so the count reflects all enrollments.

BEGIN;

CREATE OR REPLACE FUNCTION public.recalc_event_enrolled_count(p_event_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.events e
  SET enrolled_count = (
    SELECT COUNT(*)
    FROM public.event_enrollments ee
    WHERE ee.event_id = p_event_id
      AND ee.status IN ('enrolled', 'attended')
  )
  WHERE e.id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_event_enrollments_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_event_enrolled_count(NEW.event_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_event_enrolled_count(NEW.event_id);
    IF (OLD.event_id IS DISTINCT FROM NEW.event_id) THEN
      PERFORM public.recalc_event_enrolled_count(OLD.event_id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_event_enrolled_count(OLD.event_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS event_enrollments_recalc_event_count ON public.event_enrollments;

CREATE TRIGGER event_enrollments_recalc_event_count
AFTER INSERT OR UPDATE OR DELETE ON public.event_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.trg_event_enrollments_recalc();

COMMIT;

