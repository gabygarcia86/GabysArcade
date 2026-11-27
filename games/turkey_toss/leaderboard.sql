-- Turkey Toss online leaderboard: one top 10.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board, but never add, edit or delete a score. New scores only arrive
-- through the turkey-toss-score Edge Function (supabase/functions/), which checks each
-- round before saving it. Deploy that function too, or nobody can submit.

create table if not exists public.turkey_toss_scores (
  id bigint generated always as identity primary key,
  nickname text not null,
  -- bigint because stacked multipliers can push scores far past the integer limit.
  score bigint not null,
  created_at timestamptz not null default now(),
  constraint nickname_length check (char_length(nickname) between 1 and 16),
  constraint nickname_trimmed check (nickname = btrim(nickname)),
  constraint nickname_printable check (nickname !~ '[[:cntrl:]]'),
  -- The top of the range is the largest whole number a browser stores exactly.
  constraint score_range check (score between 1 and 9007199254740991)
);

-- Upgrades a table made with an older, smaller score column or limit. Postgres won't change
-- a column that a policy uses, so that policy is dropped first and recreated further down.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'turkey_toss_scores' and column_name = 'score') <> 'bigint' then
    drop policy if exists "Public can add scores" on public.turkey_toss_scores;
    alter table public.turkey_toss_scores alter column score type bigint;
  end if;
end $$;
alter table public.turkey_toss_scores drop constraint if exists score_range;
alter table public.turkey_toss_scores add constraint score_range
  check (score between 1 and 9007199254740991);

-- Keeps the top 10 query fast as the table grows.
create index if not exists turkey_toss_scores_rank_idx
  on public.turkey_toss_scores (score desc, created_at asc);

alter table public.turkey_toss_scores enable row level security;

-- Visitors can read three columns and nothing else. The Edge Function uses the secret key,
-- which skips these rules, so it needs only its own grant.
revoke all on table public.turkey_toss_scores from anon, authenticated;
grant select (nickname, score, created_at) on table public.turkey_toss_scores to anon;
grant select, insert on table public.turkey_toss_scores to service_role;

drop policy if exists "Public can read scores" on public.turkey_toss_scores;
create policy "Public can read scores"
  on public.turkey_toss_scores
  for select to anon
  using (true);

-- Older versions let visitors add scores directly. That's how fake scores got in.
drop policy if exists "Public can add scores" on public.turkey_toss_scores;

-- One row per round played. The Edge Function hands out the id as a single-use ticket when
-- a round starts, and marks it submitted when the score is saved. Visitors can't touch it.
create table if not exists public.turkey_toss_rounds (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  submitted_at timestamptz
);

create index if not exists turkey_toss_rounds_started_idx
  on public.turkey_toss_rounds (started_at);

alter table public.turkey_toss_rounds enable row level security;
revoke all on table public.turkey_toss_rounds from anon, authenticated;
grant select, insert, update, delete on table public.turkey_toss_rounds to service_role;

-- Maintenance. These are examples, so leave them commented out and run them
-- one at a time when you need them.
--
-- See the newest entries, with the id needed to remove one:
--   select id, nickname, score, created_at
--   from public.turkey_toss_scores
--   order by created_at desc
--   limit 50;
--
-- Remove one entry:
--   delete from public.turkey_toss_scores where id = 123;
--
-- Remove every entry above a score (check the list above first):
--   delete from public.turkey_toss_scores where score > 1000000000;
--
-- Wipe the board:
--   truncate table public.turkey_toss_scores restart identity;
