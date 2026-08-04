-- Binary media assets (service images, etc.)
create table if not exists media_assets (
  id           uuid primary key default gen_random_uuid(),
  content_type text not null,
  bytes        bytea not null,
  byte_size    int not null,
  created_at   timestamptz not null default now(),
  check (byte_size > 0 and byte_size <= 5242880)
);

create index if not exists media_assets_created_idx on media_assets (created_at desc);
