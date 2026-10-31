-- Droid-Chomp online leaderboards: one table, with a top 10 for each difficulty.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a score, but never edit or delete one.

create table if not exists public.droid_chomp_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  difficulty text not null,
  droid text not null,
  level integer not null,
  cycle integer not null,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint score_range check (score between 1 and 2000000000),
  constraint difficulty_known check (difficulty in ('cadet', 'normal', 'master')),
  constraint droid_known check (droid in ('r2d2', 'c3po', 'bb8', 'k2so', 'chopper', 'bd1', 'ig11', 'b1')),
  constraint level_range check (level between 1 and 10),
  constraint cycle_range check (cycle between 1 and 1000000)
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists droid_chomp_scores_rank_idx
  on public.droid_chomp_scores (difficulty, score desc, created_at asc);

alter table public.droid_chomp_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.droid_chomp_scores from anon, authenticated;
grant select (nickname, score, difficulty, droid, level, cycle, created_at) on table public.droid_chomp_scores to anon;
grant insert (nickname, score, difficulty, droid, level, cycle) on table public.droid_chomp_scores to anon;

drop policy if exists "Public can read scores" on public.droid_chomp_scores;
create policy "Public can read scores"
  on public.droid_chomp_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.droid_chomp_scores;
create policy "Public can add scores"
  on public.droid_chomp_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, difficulty, droid, level, cycle, created_at
--   from public.droid_chomp_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.droid_chomp_scores where id = 123;
--
-- Wipe every board:
--   truncate table public.droid_chomp_scores restart identity;
