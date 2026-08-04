-- 010_waitlist_and_holds.sql
-- Waitlist auto-offer + held slots. Safe to re-run.

-- 1) Appointments: allow held; exclusion covers confirmed + held
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmed','cancelled','done','no_show','held'));

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'appointments' AND c.contype = 'x'
  LOOP
    EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_period_excl
  EXCLUDE USING gist (period WITH &&) WHERE (status IN ('confirmed','held'));

-- 2) Shop settings for waitlist offer engine
ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS waitlist_offer_ttl_minutes int NOT NULL DEFAULT 15;
ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS waitlist_min_lead_minutes int NOT NULL DEFAULT 30;
ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS waitlist_max_per_phone int NOT NULL DEFAULT 2;

-- 3) Replace legacy waitlist CRM table with spec schema
DROP TABLE IF EXISTS waitlist_offers CASCADE;
DROP TABLE IF EXISTS waitlist_windows CASCADE;
DROP TABLE IF EXISTS waitlist_entries CASCADE;

CREATE TABLE waitlist_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id        uuid NOT NULL REFERENCES services(id),
  duration_minutes  int  NOT NULL,
  price_agorot      int  NOT NULL,
  client_name       text NOT NULL,
  client_phone      text NOT NULL,
  target_date       date NOT NULL,
  any_time          boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting','offered','fulfilled','cancelled','expired')),
  seq               bigserial NOT NULL,
  manage_token      text NOT NULL UNIQUE,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX waitlist_active_idx
  ON waitlist_entries (target_date, status, seq)
  WHERE status = 'waiting';
CREATE INDEX waitlist_phone_active_idx
  ON waitlist_entries (client_phone, status)
  WHERE status IN ('waiting','offered');

CREATE TABLE waitlist_windows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    uuid NOT NULL REFERENCES waitlist_entries(id) ON DELETE CASCADE,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX waitlist_windows_entry_idx ON waitlist_windows (entry_id);

CREATE TABLE waitlist_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid NOT NULL REFERENCES waitlist_entries(id),
  appointment_id  uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,
  expires_at      timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','declined','expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  responded_at    timestamptz
);
CREATE INDEX waitlist_offers_due_idx ON waitlist_offers (status, expires_at)
  WHERE status = 'pending';
CREATE UNIQUE INDEX waitlist_one_pending_offer
  ON waitlist_offers (entry_id) WHERE status = 'pending';

-- 4) Outbox: waitlist kinds; classic kinds stay unique
ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
  CHECK (kind IN (
    'confirmation','reminder','cancellation','reschedule',
    'waitlist_offer','waitlist_joined','waitlist_lost'
  ));

ALTER TABLE outbox DROP CONSTRAINT IF EXISTS outbox_appointment_id_kind_channel_key;
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'outbox' AND c.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE outbox DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS outbox_appt_kind_channel_classic_uidx
  ON outbox (appointment_id, kind, channel)
  WHERE kind IN ('confirmation','reminder','cancellation','reschedule');
