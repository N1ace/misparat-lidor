-- מספרת לידור — initial schema (spec + email/OTP extensions)
create extension if not exists btree_gist;

create table services (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  duration_minutes  int  not null check (duration_minutes > 0),
  price_agorot      int  not null default 0,
  sort_order        int  not null default 0,
  active            boolean not null default true
);

-- 0 = Sunday. One row per open window; two rows = split day.
create table working_hours (
  id           uuid primary key default gen_random_uuid(),
  day_of_week  int  not null check (day_of_week between 0 and 6),
  open_time    time not null,
  close_time   time not null,
  check (close_time > open_time)
);

create table blocks (
  id         uuid primary key default gen_random_uuid(),
  period     tstzrange not null,
  reason     text,
  created_at timestamptz not null default now()
);
create index blocks_period_idx on blocks using gist (period);

create table appointments (
  id                uuid primary key default gen_random_uuid(),
  period            tstzrange not null,
  service_id        uuid not null references services(id),
  service_name      text not null,
  duration_minutes  int  not null,
  price_agorot      int  not null,
  client_name       text not null,
  client_phone      text not null,
  client_email      text,
  status            text not null default 'confirmed'
                    check (status in ('confirmed','cancelled','done','no_show')),
  cancel_token      text not null unique,
  notes             text,
  source            text not null default 'online' check (source in ('online','manual')),
  created_at        timestamptz not null default now(),
  exclude using gist (period with &&) where (status = 'confirmed')
);
create index appointments_phone_idx on appointments (client_phone);

create table outbox (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references appointments(id) on delete cascade,
  kind            text not null check (kind in ('confirmation','reminder','cancellation')),
  channel         text not null check (channel in ('sms','email')),
  recipient       text not null,
  body            text not null,
  send_after      timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending','sent','failed')),
  attempts        int not null default 0,
  last_error      text,
  sent_at         timestamptz,
  unique (appointment_id, kind, channel)
);
create index outbox_due_idx on outbox (status, send_after);

create table admin_credentials (
  id             int primary key default 1 check (id = 1),
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

create table admin_otp (
  id           uuid primary key default gen_random_uuid(),
  code_hash    text not null,
  purpose      text not null check (purpose in ('password_change')),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index admin_otp_open_idx on admin_otp (purpose, expires_at) where consumed_at is null;
