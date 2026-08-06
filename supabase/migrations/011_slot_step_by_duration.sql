-- Align offered slots to service duration when enabled
-- e.g. 30-min haircut → 09:00, 09:30, 10:00 (not every 15 minutes)
ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS slot_step_by_duration boolean NOT NULL DEFAULT true;
