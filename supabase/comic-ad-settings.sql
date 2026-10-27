create table if not exists public.comic_ad_settings (
  comic_id uuid primary key references public.comics(id) on delete cascade,
  internal_enabled boolean not null default true,
  adsterra_enabled boolean not null default true
);

alter table public.comic_ad_settings enable row level security;

drop policy if exists "Public can read comic ad settings" on public.comic_ad_settings;
create policy "Public can read comic ad settings"
  on public.comic_ad_settings for select
  using (true);

drop policy if exists "Admins manage comic ad settings" on public.comic_ad_settings;
create policy "Admins manage comic ad settings"
  on public.comic_ad_settings for all
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

grant select on public.comic_ad_settings to anon, authenticated;
grant insert, update, delete on public.comic_ad_settings to authenticated;

notify pgrst, 'reload schema';
