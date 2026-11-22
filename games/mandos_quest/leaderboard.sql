-- Mando's Quest online leaderboard: the top 10 campaign scores.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- A campaign score is the best score from each level, plus 1,500 per Bounty Puck.
-- A game over also counts the points from the run that just ended.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.

create table if not exists public.mandos_quest_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  levels_cleared smallint not null,
  pucks smallint not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint levels_cleared_range check (levels_cleared between 0 and 10),
  constraint pucks_range check (pucks between 0 and 30),
  constraint finished_means_all_levels check (not finished or levels_cleared = 10),
  -- Pucks can only come from levels the player could open.
  constraint pucks_match_levels check (pucks <= 3 * least(levels_cleared + 1, 10)),
  -- The game caps each level at 90,000 points.
  constraint score_possible check (
    score between 1 and (90000 * least(levels_cleared + 1, 10) + 1500 * pucks)
  )
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists mandos_quest_scores_rank_idx
  on public.mandos_quest_scores (score desc, created_at asc, id asc);

alter table public.mandos_quest_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.mandos_quest_scores from anon, authenticated;
grant select (id, nickname, score, levels_cleared, pucks, finished, created_at)
  on table public.mandos_quest_scores to anon;
grant insert (nickname, score, levels_cleared, pucks, finished)
  on table public.mandos_quest_scores to anon;

drop policy if exists "Public can read scores" on public.mandos_quest_scores;
create policy "Public can read scores"
  on public.mandos_quest_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.mandos_quest_scores;
create policy "Public can add scores"
  on public.mandos_quest_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, levels_cleared, pucks, finished, created_at
--   from public.mandos_quest_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.mandos_quest_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.mandos_quest_scores restart identity;
