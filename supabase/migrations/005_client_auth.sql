-- Client auth, notify prefs, service images

alter table services add column if not exists image_path text;

alter table clients add column if not exists notify_channel text not null default 'sms';
do $$ begin
  alter table clients add constraint clients_notify_channel_check
    check (notify_channel in ('sms','email'));
exception when duplicate_object then null;
end $$;

create table if not exists client_devices (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references clients(id) on delete cascade,
  device_hash  text not null,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (client_id, device_hash)
);
create index if not exists client_devices_hash_idx on client_devices (device_hash);

create table if not exists client_otp (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  name         text not null,
  email        text,
  channel      text not null check (channel in ('sms','email')),
  recipient    text not null,
  code_hash    text not null,
  purpose      text not null default 'client_login'
               check (purpose in ('client_login')),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists client_otp_phone_idx on client_otp (phone, created_at desc);

-- Seed gallery images onto services by sort order (best-effort)
with ordered as (
  select id, row_number() over (order by sort_order, name) as rn
  from services
)
update services s set image_path = case o.rn
  when 1 then '/media/gallery-01.jpg'
  when 2 then '/media/gallery-02.jpg'
  when 3 then '/media/gallery-03.jpg'
  when 4 then '/media/gallery-04.jpg'
  else '/media/gallery-05.jpg'
end
from ordered o
where s.id = o.id and (s.image_path is null or s.image_path = '');
