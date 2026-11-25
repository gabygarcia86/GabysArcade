-- Grinch's Christmas Smash! online leaderboard: one table, the game shows its top 10.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.
--
-- Column meanings:
--   level        The last level reached in the run (1-20).
--   smashed      Decorations smashed in the run (completed levels plus failed attempts).
--   best_combo   The longest chain of smashes in the run.
--   chains       Chain reactions (3 or more smashes in a row) in the run.
--   seconds      Time spent playing, not counting menus or pauses.
--   finished     True when all 20 levels were completed.

create table if not exists public.grinch_smash_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  level integer not null,
  smashed integer not null,
  best_combo integer not null,
  chains integer not null,
  seconds integer not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint level_range check (level between 1 and 20),
  constraint finished_means_level_20 check (not finished or level = 20),
  constraint seconds_range check (seconds between 1 and 86400),
  -- A level holds at most about 80 smashable things (counting event drops and
  -- gingerbread pieces). A run counts its completed levels plus at most 3 failed tries.
  constraint smashed_possible check (smashed between 0 and 100 * (level + 3)),
  constraint combo_possible check (best_combo between 0 and smashed),
  constraint chains_possible check (chains between 0 and smashed),
  -- Smashing everything in one 5x chain, plus the chain, rainbow, unused-snowball and
  -- clean-sweep bonuses, stays well under 150,000 points a level.
  constraint score_possible check (score between 1 and 150000 * level)
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists grinch_smash_scores_rank_idx
  on public.grinch_smash_scores (score desc, created_at asc, id asc);

alter table public.grinch_smash_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.grinch_smash_scores from anon, authenticated;
grant select (id, nickname, score, level, smashed, best_combo, chains, seconds, finished, created_at)
  on table public.grinch_smash_scores to anon;
grant insert (nickname, score, level, smashed, best_combo, chains, seconds, finished)
  on table public.grinch_smash_scores to anon;

drop policy if exists "Public can read scores" on public.grinch_smash_scores;
create policy "Public can read scores"
  on public.grinch_smash_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.grinch_smash_scores;
create policy "Public can add scores"
  on public.grinch_smash_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, level, smashed, best_combo, chains, seconds, finished, created_at
--   from public.grinch_smash_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.grinch_smash_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.grinch_smash_scores restart identity;
