-- 參考 political-spectrum 的 data 表：每人每座核電廠一列
-- （已套用到 Supabase 專案 idjdjhmqrdxunyolbqlp，migration: create_data_table）
create table public.data (
  id bigint generated always as identity primary key,
  cookie_id text not null check (char_length(cookie_id) between 8 and 64),
  name text not null check (name in ('核一', '核二', '核三', '核四')),
  lat double precision not null check (lat between 18 and 29),
  lon double precision not null check (lon between 115 and 128),
  created_at timestamptz not null default now(),
  update_at timestamptz not null default now(),
  -- 每人每座只能有一筆 → 只能上傳一次
  constraint data_cookie_id_name_key unique (cookie_id, name)
);

create index data_update_at_idx on public.data (update_at);

-- 時間一律由伺服器決定，不信任前端
create or replace function public.data_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  new.update_at := now();
  return new;
end;
$$;

create trigger data_set_timestamps
before insert on public.data
for each row execute function public.data_set_timestamps();

alter table public.data enable row level security;

-- 匿名：可讀、可新增；不能改、不能刪
create policy "anon can read" on public.data
  for select to anon, authenticated using (true);

create policy "anon can insert" on public.data
  for insert to anon, authenticated with check (true);

revoke update, delete, truncate on public.data from anon, authenticated;
