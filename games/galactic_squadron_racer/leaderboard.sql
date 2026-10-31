-- Galactic Squadron Racer online leaderboards: one top 10 per track.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a time, but never edit or delete one.

create table if not exists public.galactic_squadron_racer_times (
  id bigint generated always as identity primary key,
  track text not null,
  nickname text not null,
  time_ms integer not null,
  created_at timestamptz not null default now(),
  constraint track_format check (track ~ '^[a-z0-9-]{1,32}$'),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  -- Three laps at top AI pace take about a minute, so under 20 seconds isn't a real run.
  constraint time_range check (time_ms between 20000 and 3600000)
);

-- Keeps each track's top 10 query fast as the table grows.
create index if not exists galactic_squadron_racer_times_rank_idx
  on public.galactic_squadron_racer_times (track, time_ms asc, created_at asc);

alter table public.galactic_squadron_racer_times enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.galactic_squadron_racer_times from anon, authenticated;
grant select (track, nickname, time_ms, created_at) on table public.galactic_squadron_racer_times to anon;
grant insert (track, nickname, time_ms) on table public.galactic_squadron_racer_times to anon;

drop policy if exists "Public can read times" on public.galactic_squadron_racer_times;
create policy "Public can read times"
  on public.galactic_squadron_racer_times
  for select to anon
  using (true);

drop policy if exists "Public can add times" on public.galactic_squadron_racer_times;
create policy "Public can add times"
  on public.galactic_squadron_racer_times
  for insert to anon
  with check (time_ms > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, track, nickname, time_ms, created_at
--   from public.galactic_squadron_racer_times
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.galactic_squadron_racer_times where id = 123;
--
-- Wipe one track's board:
--   delete from public.galactic_squadron_racer_times where track = 'desert';
--
-- Wipe every board:
--   truncate table public.galactic_squadron_racer_times restart identity;
