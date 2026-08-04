-- Reminder timing (hours before appointment)
alter table shop_settings
  add column if not exists reminder_hours_before int not null default 24
  check (reminder_hours_before between 1 and 168);
