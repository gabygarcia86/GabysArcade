-- UFO Abduction online leaderboards: one table, with a top 10 for Classic and Endless.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.
--
-- Column meanings:
--   level       Classic: the level reached (1-5). Endless: the zone reached (1 and up).
--   seconds     Time spent flying, not counting pauses.
--   finished    Classic only: true when all five levels were completed.

create table if not exists public.ufo_abduction_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  mode text not null,
  level integer not null,
  abductions integer not null,
  rescues integer not null,
  best_combo integer not null,
  seconds integer not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint mode_known check (mode in ('classic', 'endless')),
  constraint seconds_range check (seconds between 1 and 86400),
  -- Classic is five levels of 60, 70, 80, 90 and 100 seconds, 400 seconds in all (the limit leaves slack).
  constraint classic_shape check (
    mode <> 'classic' or (level between 1 and 5 and seconds <= 500)
  ),
  -- Endless moves to a new zone every 60 seconds.
  constraint endless_shape check (
    mode <> 'endless' or (level between 1 and 1500 and level <= seconds / 60 + 1 and not finished)
  ),
  constraint finished_means_level_5 check (not finished or level = 5),
  -- At most a few new people and animals appear each second.
  constraint abductions_possible check (abductions between 0 and 40 + 4 * seconds),
  -- Classic schedules at most 11 alien appearances; endless at most one every 20 seconds.
  constraint rescues_possible check (rescues between 0 and 7 + seconds / 5),
  constraint best_combo_possible check (best_combo between 0 and abductions),
  -- The most one abduction can earn is 200 points x5 combo x2 double points, plus streak
  -- bonuses. Rescues earn up to 2,000, plus 10,000 per family of seven. Each level or zone
  -- adds at most 9,500 in bonuses, and a spare repair kit is worth 250.
  constraint score_possible check (
    score between 1 and (2500 * abductions + 3500 * rescues + 15000 * level + 100 * seconds + 20000)
  )
);

-- Keeps each mode's top 10 query fast as the table grows.
create index if not exists ufo_abduction_scores_rank_idx
  on public.ufo_abduction_scores (mode, score desc, created_at asc, id asc);

alter table public.ufo_abduction_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.ufo_abduction_scores from anon, authenticated;
grant select (id, nickname, score, mode, level, abductions, rescues, best_combo, seconds, finished, created_at)
  on table public.ufo_abduction_scores to anon;
grant insert (nickname, score, mode, level, abductions, rescues, best_combo, seconds, finished)
  on table public.ufo_abduction_scores to anon;

drop policy if exists "Public can read scores" on public.ufo_abduction_scores;
create policy "Public can read scores"
  on public.ufo_abduction_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.ufo_abduction_scores;
create policy "Public can add scores"
  on public.ufo_abduction_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, mode, level, abductions, rescues, best_combo, seconds, finished, created_at
--   from public.ufo_abduction_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.ufo_abduction_scores where id = 123;
--
-- Wipe one board:
--   delete from public.ufo_abduction_scores where mode = 'endless';
--
-- Wipe both boards:
--   truncate table public.ufo_abduction_scores restart identity;
