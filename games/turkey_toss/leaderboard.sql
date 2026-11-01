-- Turkey Toss online leaderboard: one top 10.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It's safe to run again.
--
-- The website uses a public key, so these rules decide what visitors can do:
-- they can read the board and add a score, but never edit or delete one.

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

-- Column-level grants stop visitors setting their own id or created_at.
revoke all on table public.turkey_toss_scores from anon, authenticated;
grant select (nickname, score, created_at) on table public.turkey_toss_scores to anon;
grant insert (nickname, score) on table public.turkey_toss_scores to anon;

drop policy if exists "Public can read scores" on public.turkey_toss_scores;
create policy "Public can read scores"
  on public.turkey_toss_scores
  for select to anon
  using (true);

drop policy if exists "Public can add scores" on public.turkey_toss_scores;
create policy "Public can add scores"
  on public.turkey_toss_scores
  for insert to anon
  with check (score > 0);

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
-- Wipe the board:
--   truncate table public.turkey_toss_scores restart identity;
