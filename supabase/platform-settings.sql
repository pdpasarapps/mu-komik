create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'MU-Komik sedang dalam pemeliharaan. Silakan kembali lagi nanti.',
  announcement_enabled boolean not null default false,
  announcement_message text not null default '',
  feature_flags jsonb not null default '{"reading":true,"search":true,"creators":true,"comments":true,"favorites":true}'::jsonb
    check (jsonb_typeof(feature_flags) = 'object'),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "Platform settings are publicly readable" on public.platform_settings;
create policy "Platform settings are publicly readable"
  on public.platform_settings for select
  using (true);

drop policy if exists "Admins manage platform settings" on public.platform_settings;
create policy "Admins manage platform settings"
  on public.platform_settings for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

grant select on public.platform_settings to anon, authenticated;
grant insert, update on public.platform_settings to authenticated;

insert into public.platform_settings (id)
values (true)
on conflict (id) do nothing;
