-- Jedi Story online leaderboard: the top 10 campaign scores.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- A campaign score is the best score from every level cleared, plus the score in
-- the current level when the run ends in a game over.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.

create table if not exists public.jedi_story_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  levels_cleared smallint not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint score_range check (score between 1 and 2000000000),
  constraint levels_cleared_range check (levels_cleared between 0 and 10),
  constraint finished_means_all_levels check (not finished or levels_cleared = 10)
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists jedi_story_scores_rank_idx
  on public.jedi_story_scores (score desc, created_at asc);

alter table public.jedi_story_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.jedi_story_scores from anon, authenticated;
grant select (nickname, score, levels_cleared, finished, created_at) on table public.jedi_story_scores to anon;
grant insert (nickname, score, levels_cleared, finished) on table public.jedi_story_scores to anon;

drop policy if exists "Public can read scores" on public.jedi_story_scores;
create policy "Public can read scores"
  on public.jedi_story_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.jedi_story_scores;
create policy "Public can add scores"
  on public.jedi_story_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, levels_cleared, finished, created_at
--   from public.jedi_story_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.jedi_story_scores where id = 123;
--
-- Wipe the board:
--   truncate table public.jedi_story_scores restart identity;
