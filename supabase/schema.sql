do $$ begin
  create type public.user_role as enum ('reader', 'creator', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.comic_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Reader',
  avatar_key text,
  role public.user_role not null default 'reader',
  created_at timestamptz not null default now()
);

create table if not exists public.comics (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  title text not null,
  slug text not null unique,
  synopsis text not null default '',
  cover_key text,
  genre text not null default 'Drama',
  status public.comic_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  comic_id uuid not null references public.comics(id) on delete cascade,
  title text not null,
  chapter_number numeric not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (comic_id, chapter_number)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  object_key text not null,
  created_at timestamptz not null default now(),
  unique (chapter_id, page_number)
);

create table if not exists public.reading_history (
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  last_page integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comic_id uuid not null references public.comics(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comic_id, chapter_id)
);

alter table public.profiles enable row level security;
alter table public.comics enable row level security;
alter table public.chapters enable row level security;
alter table public.pages enable row level security;
alter table public.reading_history enable row level security;
alter table public.bookmarks enable row level security;

drop policy if exists "Published comics are public" on public.comics;
drop policy if exists "Published chapters are public" on public.chapters;
drop policy if exists "Published pages are public" on public.pages;
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "Users manage own history" on public.reading_history;
drop policy if exists "Users manage own bookmarks" on public.bookmarks;
drop policy if exists "Creators manage own comics" on public.comics;
drop policy if exists "Creators manage own chapters" on public.chapters;
drop policy if exists "Creators manage own pages" on public.pages;

create policy "Published comics are public" on public.comics for select using (status = 'published' or creator_id = auth.uid());
create policy "Published chapters are public" on public.chapters for select using (
  exists (select 1 from public.comics where comics.id = chapters.comic_id and (comics.status = 'published' or comics.creator_id = auth.uid()))
);
create policy "Published pages are public" on public.pages for select using (
  exists (select 1 from public.chapters join public.comics on comics.id = chapters.comic_id where chapters.id = pages.chapter_id and (comics.status = 'published' or comics.creator_id = auth.uid()))
);
create policy "Users read own profile" on public.profiles for select using (id = auth.uid());
create policy "Users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage own history" on public.reading_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own bookmarks" on public.bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Creators manage own comics" on public.comics for all using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "Creators manage own chapters" on public.chapters for all using (
  exists (select 1 from public.comics where comics.id = chapters.comic_id and comics.creator_id = auth.uid())
) with check (
  exists (select 1 from public.comics where comics.id = chapters.comic_id and comics.creator_id = auth.uid())
);
create policy "Creators manage own pages" on public.pages for all using (
  exists (select 1 from public.chapters join public.comics on comics.id = chapters.comic_id where chapters.id = pages.chapter_id and comics.creator_id = auth.uid())
) with check (
  exists (select 1 from public.chapters join public.comics on comics.id = chapters.comic_id where chapters.id = pages.chapter_id and comics.creator_id = auth.uid())
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Reader'));
  return new;
end;
$$;

create or replace function public.protect_profile_role() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and old.role is distinct from new.role and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only an admin can change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.protect_profile_role();
