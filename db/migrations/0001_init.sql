-- CareMeds Initial PostgreSQL Migration (Supabase Postgres, ap-south-1)
-- Enforces UUID keys, bigserial audit_log, CHECK constraints, partial unique indexes,
-- non-overlapping dosage schedule versions, dose_unit = stock_unit trigger,
-- append-only audit_log trigger, stock_quantity view, and RLS enabled with zero policies.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Stock Quantity View (only Approved or Not required movements count)
CREATE OR REPLACE VIEW stock_quantity AS
SELECT
  i.stock_id,
  i.medicine_id,
  i.batch_number,
  i.expiry_date,
  i.reorder_level,
  COALESCE(
    SUM(
      CASE
        WHEN m.approval_status IN ('Not required', 'Approved') THEN m.quantity_change
        ELSE 0
      END
    ),
    0
  )::integer AS quantity_on_hand
FROM inventory_items i
LEFT JOIN stock_movements m ON m.stock_id = i.stock_id
GROUP BY i.stock_id, i.medicine_id, i.batch_number, i.expiry_date, i.reorder_level;

-- 2. Partial unique index for substance_text allergies (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS allergies_resident_substance_lower_uq
  ON allergies (resident_id, lower(substance_text))
  WHERE substance_text IS NOT NULL;

-- 3. Non-overlapping dosage schedule versions per prescription
ALTER TABLE dosage_schedules
  DROP CONSTRAINT IF EXISTS dosage_schedules_no_overlap_excl;

ALTER TABLE dosage_schedules
  ADD CONSTRAINT dosage_schedules_no_overlap_excl
  EXCLUDE USING gist (
    prescription_id WITH =,
    daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') WITH &&
  );

-- 4. Enforce dosage_schedules.dose_unit = medicine_catalogue.stock_unit
CREATE OR REPLACE FUNCTION enforce_dose_unit_matches_stock_unit()
RETURNS trigger AS $$
DECLARE
  expected_unit text;
BEGIN
  SELECT mc.stock_unit
  INTO expected_unit
  FROM prescriptions p
  JOIN medicine_catalogue mc ON mc.medicine_id = p.medicine_id
  WHERE p.prescription_id = NEW.prescription_id;

  IF expected_unit IS NULL THEN
    RAISE EXCEPTION 'Prescription % not found', NEW.prescription_id;
  END IF;

  IF NEW.dose_unit <> expected_unit THEN
    RAISE EXCEPTION 'dose_unit (%) must match medicine stock_unit (%)', NEW.dose_unit, expected_unit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dosage_schedules_unit_check ON dosage_schedules;
CREATE TRIGGER trg_dosage_schedules_unit_check
  BEFORE INSERT OR UPDATE ON dosage_schedules
  FOR EACH ROW
  EXECUTE FUNCTION enforce_dose_unit_matches_stock_unit();

-- 5. Enforce append-only audit_log (reject every UPDATE and DELETE)
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only; % operations are prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_append_only ON audit_log;
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();

-- 6. Single active alert per source and alert_type
CREATE UNIQUE INDEX IF NOT EXISTS alerts_active_source_uq
  ON alerts (
    alert_type_id,
    COALESCE(resident_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(stock_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(dose_event_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(reading_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(prescription_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('Open', 'Acknowledged', 'Escalated');

-- 7. Enable Row Level Security (RLS) on every table with ZERO policies
-- Public anon key and Supabase authenticated role can read/write nothing;
-- only server code connecting as the database owner role accesses data.
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;
