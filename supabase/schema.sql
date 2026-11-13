-- ========================================================
-- Tiny Isles: 멀티플레이어 서버 공유 데이터베이스 스키마
-- Supabase Dashboard -> SQL Editor에 붙여넣고 [Run]을 누르세요.
-- ========================================================

-- 1. 해금된 섬(땅) 테이블 생성
create table if not exists public.unlocked_islands (
  island_id integer primary key,
  island_name text not null,
  unlocked_by text not null default '익명의 모험가',
  unlocked_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Row Level Security) 활성화
alter table public.unlocked_islands enable row level security;

-- 누구나 해금된 섬 목록을 조회할 수 있도록 허용
create policy "모든 사용자 섬 목록 조회 허용"
  on public.unlocked_islands for select
  using (true);

-- 누구나 새로운 섬 해금을 등록할 수 있도록 허용
create policy "모든 사용자 섬 해금 등록 허용"
  on public.unlocked_islands for insert
  with check (true);

-- 누구나 섬 해금 정보 갱신 허용 (upsert 충돌 방지)
create policy "모든 사용자 섬 해금 갱신 허용"
  on public.unlocked_islands for update
  using (true)
  with check (true);

-- 누구나 섬 해금 정보 삭제 허용 (초기화 지원)
create policy "모든 사용자 섬 해금 삭제 허용"
  on public.unlocked_islands for delete
  using (true);

-- 2. 플레이어 정보 및 자원(인벤토리) 테이블 생성
create table if not exists public.players (
  id text primary key,
  name text not null,
  color text not null default 'blue',
  wood integer not null default 5,
  stone integer not null default 2,
  gold integer not null default 0,
  last_active_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 활성화
alter table public.players enable row level security;

-- 누구나 플레이어 목록 조회 허용
create policy "모든 사용자 플레이어 정보 조회 허용"
  on public.players for select
  using (true);

-- 플레이어 정보 등록 및 갱신 허용
create policy "모든 사용자 플레이어 정보 등록 허용"
  on public.players for insert
  with check (true);

create policy "모든 사용자 플레이어 정보 갱신 허용"
  on public.players for update
  using (true)
  with check (true);

create policy "모든 사용자 플레이어 정보 삭제 허용"
  on public.players for delete
  using (true);

-- 3. 시작의 섬(0번) 기본 행 추가
insert into public.unlocked_islands (island_id, island_name, unlocked_by)
values (0, '시작의 섬 (Home Isle)', '시스템')
on conflict (island_id) do nothing;

-- 4. Supabase Realtime 활성화 (테이블 변경 시 접속자 전원에게 실시간 브로드캐스트)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'unlocked_islands'
  ) then
    alter publication supabase_realtime add table public.unlocked_islands;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
end;
$$;

-- ========================================================
-- 5. 리빙 아일즈(Living Isles): 월드 영구 상태 & 오프라인 수비대
-- ========================================================
create table if not exists public.world_state (
  world_id text primary key,
  last_active_at timestamp with time zone default timezone('utc'::text, now()) not null,
  wave_count integer not null default 0,
  boss_wave_count integer not null default 0,
  unlocked_island_ids jsonb not null default '[0]'::jsonb,
  village_tiers jsonb not null default '{"0": 2}'::jsonb,
  core_hps jsonb not null default '{"0": 350}'::jsonb,
  constructed_buildings jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.world_state enable row level security;

create policy "모든 사용자 월드 상태 조회 허용"
  on public.world_state for select
  using (true);

create policy "모든 사용자 월드 상태 등록 허용"
  on public.world_state for insert
  with check (true);

create policy "모든 사용자 월드 상태 갱신 허용"
  on public.world_state for update
  using (true)
  with check (true);

create table if not exists public.player_garrisons (
  player_id text primary key,
  name text not null,
  color text not null default 'blue',
  territory_id integer not null default 0,
  x double precision not null default 320,
  y double precision not null default 350,
  power integer not null default 110,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.player_garrisons enable row level security;

create policy "모든 사용자 수비대 조회 허용"
  on public.player_garrisons for select
  using (true);

create policy "모든 사용자 수비대 등록 허용"
  on public.player_garrisons for insert
  with check (true);

create policy "모든 사용자 수비대 갱신 허용"
  on public.player_garrisons for update
  using (true)
  with check (true);

create policy "모든 사용자 수비대 삭제 허용"
  on public.player_garrisons for delete
  using (true);

insert into public.world_state (world_id, wave_count, boss_wave_count)
values ('main_world', 0, 0)
on conflict (world_id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'world_state'
  ) then
    alter publication supabase_realtime add table public.world_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'player_garrisons'
  ) then
    alter publication supabase_realtime add table public.player_garrisons;
  end if;
end;
$$;

