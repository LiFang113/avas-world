create table if not exists public.ava_accounts (
  id text primary key,
  name text not null,
  search_name text not null,
  age integer,
  avatar text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ava_accounts_search_name_idx on public.ava_accounts (search_name);

create table if not exists public.ava_friendships (
  owner_id text not null references public.ava_accounts(id) on delete cascade,
  friend_id text not null references public.ava_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);

create table if not exists public.ava_messages (
  id text primary key,
  user_id text not null references public.ava_accounts(id) on delete cascade,
  name text not null,
  avatar text,
  color text,
  text text not null,
  sent_at_ms bigint not null,
  recipient_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ava_messages_sent_at_idx on public.ava_messages (sent_at_ms desc);

create table if not exists public.ava_presence (
  user_id text primary key references public.ava_accounts(id) on delete cascade,
  name text not null,
  avatar text,
  color text,
  last_seen_ms bigint not null
);

alter table public.ava_accounts enable row level security;
alter table public.ava_friendships enable row level security;
alter table public.ava_messages enable row level security;
alter table public.ava_presence enable row level security;

create policy "Ava accounts are searchable"
  on public.ava_accounts for select
  using (true);

create policy "Ava accounts can be created"
  on public.ava_accounts for insert
  with check (true);

create policy "Ava accounts can be updated"
  on public.ava_accounts for update
  using (true)
  with check (true);

create policy "Ava friendships are readable"
  on public.ava_friendships for select
  using (true);

create policy "Ava friendships can be created"
  on public.ava_friendships for insert
  with check (true);

create policy "Ava friendships can be removed"
  on public.ava_friendships for delete
  using (true);

create policy "Ava messages are readable"
  on public.ava_messages for select
  using (true);

create policy "Ava messages can be sent"
  on public.ava_messages for insert
  with check (true);

create policy "Ava presence is readable"
  on public.ava_presence for select
  using (true);

create policy "Ava presence can be written"
  on public.ava_presence for insert
  with check (true);

create policy "Ava presence can be updated"
  on public.ava_presence for update
  using (true)
  with check (true);
