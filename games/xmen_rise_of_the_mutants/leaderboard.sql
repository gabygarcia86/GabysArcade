-- X-Men: Rise of the Mutants online leaderboard: the top 10 campaign scores.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- A campaign score is the best score from each cleared level (each capped at 90,000),
-- plus 2,500 per X symbol found. A game over also adds the points from the run that
-- just ended (also capped at 90,000).
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.
-- Scores are calculated in the browser, so the limits below reject impossible
-- entries but can't prove that a believable one was honestly earned.
--
-- Column meanings:
--   score           Campaign score.
--   levels_cleared  Story levels cleared (0-20).
--   x_symbols       X symbols found across all levels (3 per level, 60 in all).
--   hero            The X-Man the player was using.
--   finished        True when the whole campaign has been completed.

create table if not exists public.xmen_rise_of_the_mutants_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  score integer not null,
  levels_cleared smallint not null,
  x_symbols smallint not null,
  hero text not null,
  finished boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  constraint levels_cleared_range check (levels_cleared between 0 and 20),
  -- X symbols are only saved from levels the player has cleared.
  constraint x_symbols_range check (x_symbols between 0 and 3 * levels_cleared),
  constraint finished_means_all_levels check (not finished or levels_cleared = 20),
  constraint score_possible check (
    score between 1 and (90000 * (levels_cleared + 1) + 2500 * x_symbols)
  ),
  constraint hero_known check (hero in ('cyclops', 'wolverine', 'storm', 'jean', 'beast', 'gambit', 'nightcrawler', 'colossus', 'iceman', 'psylocke', 'jubilee', 'professorx'))
);

-- Keeps the top 10 query fast as the table grows.
create index if not exists xmen_rise_of_the_mutants_scores_rank_idx
  on public.xmen_rise_of_the_mutants_scores (score desc, created_at asc, id asc);

alter table public.xmen_rise_of_the_mutants_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
-- id and created_at are readable only so that tied scores sort consistently.
revoke all on table public.xmen_rise_of_the_mutants_scores from anon, authenticated;
grant select (id, nickname, score, levels_cleared, x_symbols, hero, finished, created_at)
  on table public.xmen_rise_of_the_mutants_scores to anon;
grant insert (nickname, score, levels_cleared, x_symbols, hero, finished)
  on table public.xmen_rise_of_the_mutants_scores to anon;

drop policy if exists "Public can read scores" on public.xmen_rise_of_the_mutants_scores;
create policy "Public can read scores"
  on public.xmen_rise_of_the_mutants_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.xmen_rise_of_the_mutants_scores;
create policy "Public can add scores"
  on public.xmen_rise_of_the_mutants_scores
  for insert to anon
  with check (score > 0);

-- Tells the API about the new table straight away.
notify pgrst, 'reload schema';

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, levels_cleared, x_symbols, hero, finished, created_at
--   from public.xmen_rise_of_the_mutants_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.xmen_rise_of_the_mutants_scores where id = 123;
--
-- Wipe the whole board:
--   truncate table public.xmen_rise_of_the_mutants_scores restart identity;
