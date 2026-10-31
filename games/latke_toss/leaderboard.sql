-- Latke Toss online leaderboards: one top 10 per difficulty.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards and add a score, but never edit or delete one.

create table if not exists public.latke_toss_scores (
  id bigint generated always as identity primary key,
  difficulty text not null,
  nickname text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint difficulty_known check (difficulty in ('easy', 'medium', 'hard')),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  -- Generous on purpose: dreidel boosts stack, so high scores can climb quickly.
  constraint score_range check (score between 1 and 1000000)
);

-- Keeps each difficulty's top 10 query fast as the table grows.
create index if not exists latke_toss_scores_rank_idx
  on public.latke_toss_scores (difficulty, score desc, created_at asc);

alter table public.latke_toss_scores enable row level security;

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.latke_toss_scores from anon, authenticated;
grant select (difficulty, nickname, score, created_at) on table public.latke_toss_scores to anon;
grant insert (difficulty, nickname, score) on table public.latke_toss_scores to anon;

drop policy if exists "Public can read scores" on public.latke_toss_scores;
create policy "Public can read scores"
  on public.latke_toss_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.latke_toss_scores;
create policy "Public can add scores"
  on public.latke_toss_scores
  for insert to anon
  with check (score > 0);

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, difficulty, nickname, score, created_at
--   from public.latke_toss_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.latke_toss_scores where id = 123;
--
-- Wipe one difficulty's board:
--   delete from public.latke_toss_scores where difficulty = 'easy';
--
-- Wipe every board:
--   truncate table public.latke_toss_scores restart identity;
