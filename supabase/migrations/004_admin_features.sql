-- Clients, waitlist, shop settings for admin features (YeshTor-inspired, single-barber)

create table if not exists shop_settings (
  id                          int primary key default 1 check (id = 1),
  business_name               text not null default 'מספרת לידור',
  business_phone              text not null default '053-530-1669',
  business_address            text not null default 'אבנר בן נר 1, אשדוד',
  owner_email                 text,
  online_booking_horizon_days int not null default 30 check (online_booking_horizon_days between 1 and 365),
  manual_booking_horizon_days int not null default 90 check (manual_booking_horizon_days between 1 and 730),
  min_client_cancel_minutes   int not null default 60 check (min_client_cancel_minutes between 0 and 10080),
  lead_minutes                int not null default 30 check (lead_minutes between 0 and 1440),
  slot_step_minutes           int not null default 15 check (slot_step_minutes in (5,10,15,20,30,60)),
  buffer_minutes              int not null default 0 check (buffer_minutes between 0 and 120),
  notify_confirmation         boolean not null default true,
  notify_reminder             boolean not null default true,
  notify_cancellation         boolean not null default true,
  waitlist_enabled            boolean not null default true,
  updated_at                  timestamptz not null default now()
);

insert into shop_settings (id) values (1)
on conflict (id) do nothing;

create table if not exists clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  email        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists clients_phone_uidx on clients (phone);
create index if not exists clients_name_idx on clients (name);

create table if not exists waitlist_entries (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null,
  client_phone text not null,
  service_id   uuid references services(id) on delete set null,
  preferred_date date,
  notes        text,
  status       text not null default 'waiting'
               check (status in ('waiting','offered','booked','cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists waitlist_status_idx on waitlist_entries (status, created_at);

-- Optional all-day flag for blocks used as closures
alter table blocks add column if not exists all_day boolean not null default false;
