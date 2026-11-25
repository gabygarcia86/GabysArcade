-- Grinch's Christmas Heist online leaderboard: one table, the game shows its top 10.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.
--
-- Column meanings:
--   level       The last level played (1-10).
--   loot        Items stolen across the whole game.
--   presents    How many of those were presents.
--   caught      Times the Grinch was caught.
--   seconds     Time spent heisting, not counting menus or pauses.
--   finished    True when all ten levels were played.

create table if not exists public.grinch_heist_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  level integer not null,
  loot integer not null,
  presents integer not null,
  caught integer not null,
  seconds integer not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint level_range check (level between 1 and 10),
  -- Every level lasts at most 60 seconds (the limit leaves a little slack).
  constraint seconds_range check (seconds between 1 and level * 65),
  constraint finished_means_level_10 check (not finished or level = 10),
  -- A level has at most about 80 pieces of loot, counting Max's finds and golden presents.
  constraint loot_possible check (loot between 0 and 120 * level),
  constraint presents_possible check (presents between 0 and loot),
  constraint caught_possible check (caught between 0 and 1000),
  -- The best item is worth 200, doubled by Max's bonus. Each level adds at most about
  -- 2,000 in escape, time, clean-getaway and Golden Gift bonuses.
  constraint score_possible check (score between 1 and (450 * loot + 2500 * level + 1000))
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists grinch_heist_scores_rank_idx
  on public.grinch_heist_scores (score desc, created_at asc, id asc);

alter table public.grinch_heist_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.grinch_heist_scores from anon, authenticated;
grant select (id, nickname, score, level, loot, presents, caught, seconds, finished, created_at)
  on table public.grinch_heist_scores to anon;
grant insert (nickname, score, level, loot, presents, caught, seconds, finished)
  on table public.grinch_heist_scores to anon;

drop policy if exists "Public can read scores" on public.grinch_heist_scores;
create policy "Public can read scores"
  on public.grinch_heist_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.grinch_heist_scores;
create policy "Public can add scores"
  on public.grinch_heist_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, level, loot, presents, caught, seconds, finished, created_at
--   from public.grinch_heist_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.grinch_heist_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.grinch_heist_scores restart identity;
