-- 每次作答一列：四個點的經緯度
create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  cookie_id text not null check (char_length(cookie_id) <= 64),
  p1_lon double precision not null, p1_lat double precision not null,
  p2_lon double precision not null, p2_lat double precision not null,
  p3_lon double precision not null, p3_lat double precision not null,
  p4_lon double precision not null, p4_lat double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_created_at_idx on public.submissions (created_at);

alter table public.submissions enable row level security;

-- 匿名使用者：可新增、可讀取，不能改也不能刪
drop policy if exists "anon can read" on public.submissions;
create policy "anon can read" on public.submissions
  for select to anon using (true);

drop policy if exists "anon can insert" on public.submissions;
create policy "anon can insert" on public.submissions
  for insert to anon with check (
    -- 只收地圖畫面範圍附近的點，擋掉亂塞的資料
    p1_lon between 115 and 128 and p1_lat between 18 and 29 and
    p2_lon between 115 and 128 and p2_lat between 18 and 29 and
    p3_lon between 115 and 128 and p3_lat between 18 and 29 and
    p4_lon between 115 and 128 and p4_lat between 18 and 29
  );
