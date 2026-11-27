-- Latke Toss online leaderboards: one top 10 per difficulty.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the boards, but never add, edit or delete a score. New scores only arrive
-- through the latke-toss-score Edge Function (supabase/functions/), which checks each
-- round before saving it. Deploy that function too, or nobody can submit.

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
  -- Generous on purpose: streak tiers, dreidel boosts and the Final Fry all stack.
  constraint score_range check (score between 1 and 100000000)
);

-- Tables made before the streak tiers allowed scores only up to 1,000,000. This raises
-- the cap on an existing table too (and is harmless on a new one).
alter table public.latke_toss_scores drop constraint if exists score_range;
alter table public.latke_toss_scores
  add constraint score_range check (score between 1 and 100000000);

-- Keeps each difficulty's top 10 query fast as the table grows.
create index if not exists latke_toss_scores_rank_idx
  on public.latke_toss_scores (difficulty, score desc, created_at asc);

alter table public.latke_toss_scores enable row level security;

-- Visitors can read four columns and nothing else. The Edge Function uses the secret key,
-- which skips these rules, so it needs only its own grant.
revoke all on table public.latke_toss_scores from anon, authenticated;
grant select (difficulty, nickname, score, created_at) on table public.latke_toss_scores to anon;
grant select, insert on table public.latke_toss_scores to service_role;

drop policy if exists "Public can read scores" on public.latke_toss_scores;
create policy "Public can read scores"
  on public.latke_toss_scores
  for select to anon
  using (true);

-- Older versions let visitors add scores directly, so anyone could post any number.
drop policy if exists "Public can add scores" on public.latke_toss_scores;

-- One row per round played. The Edge Function hands out the id as a single-use ticket when
-- a round starts, and marks it submitted when the score is saved. Visitors can't touch it.
create table if not exists public.latke_toss_rounds (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null,
  started_at timestamptz not null,
  submitted_at timestamptz,
  constraint difficulty_known check (difficulty in ('easy', 'medium', 'hard'))
);

create index if not exists latke_toss_rounds_started_idx
  on public.latke_toss_rounds (started_at);

alter table public.latke_toss_rounds enable row level security;
revoke all on table public.latke_toss_rounds from anon, authenticated;
grant select, insert, update, delete on table public.latke_toss_rounds to service_role;

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
-- Remove every entry above a score (check the list above first):
--   delete from public.latke_toss_scores where score > 1000000;
--
-- Wipe one difficulty's board:
--   delete from public.latke_toss_scores where difficulty = 'easy';
--
-- Wipe every board:
--   truncate table public.latke_toss_scores restart identity;
