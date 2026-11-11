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
