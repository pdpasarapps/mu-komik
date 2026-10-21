create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '',
  content_markdown text not null default '',
  category text not null default 'Komik',
  title_en text not null default '',
  excerpt_en text not null default '',
  content_markdown_en text not null default '',
  category_en text not null default '',
  cover_key text,
  seo_title text,
  seo_description text,
  seo_title_en text,
  seo_description_en text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_name text not null default 'Tim MU-Komik',
  author_id uuid not null references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);

alter table public.articles
  add column if not exists title_en text not null default '',
  add column if not exists excerpt_en text not null default '',
  add column if not exists content_markdown_en text not null default '',
  add column if not exists category_en text not null default '',
  add column if not exists seo_title_en text,
  add column if not exists seo_description_en text;

create index if not exists articles_published_at_idx
  on public.articles (published_at desc)
  where status = 'published';

alter table public.articles enable row level security;
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;

drop policy if exists "Published articles are public" on public.articles;
create policy "Published articles are public" on public.articles
  for select using (status = 'published' and published_at <= now());

drop policy if exists "Admins manage articles" on public.articles;
create policy "Admins manage articles" on public.articles
  for all to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

create or replace function public.set_article_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
  before update on public.articles
  for each row execute function public.set_article_updated_at();

notify pgrst, 'reload schema';
