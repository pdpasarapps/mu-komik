-- Run in Supabase SQL Editor to enable advertiser submissions and admin review.
create table if not exists public.ad_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  advertiser_name text not null check (length(btrim(advertiser_name)) between 1 and 120),
  contact_email text not null check (length(btrim(contact_email)) between 3 and 254),
  contact_whatsapp text check (contact_whatsapp is null or length(btrim(contact_whatsapp)) <= 40),
  campaign_title text not null check (length(btrim(campaign_title)) between 1 and 120),
  description text not null check (length(btrim(description)) between 1 and 500),
  destination_url text not null check (destination_url ~* '^https?://[^[:space:]]+$'),
  image_url text check (image_url is null or image_url ~* '^https?://[^[:space:]]+$'),
  placements text[] not null check (
    cardinality(placements) > 0
    and placements <@ array[
      'home_banner',
      'catalog_grid_native',
      'comic_detail_sponsor',
      'reader_mid_chapter',
      'reader_episode_transition'
    ]::text[]
  ),
  requested_start date,
  requested_end date,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'approved', 'rejected')),
  admin_note text not null default '' check (length(admin_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_request_dates_valid check (
    requested_start is null
    or requested_end is null
    or requested_end >= requested_start
  )
);

create index if not exists ad_requests_user_created_idx
  on public.ad_requests(user_id, created_at desc);
create index if not exists ad_requests_status_created_idx
  on public.ad_requests(status, created_at desc);

alter table public.ad_requests enable row level security;

drop policy if exists "Users view own ad requests" on public.ad_requests;
create policy "Users view own ad requests"
  on public.ad_requests for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Users submit own ad requests" on public.ad_requests;
create policy "Users submit own ad requests"
  on public.ad_requests for insert
  with check (user_id = auth.uid() and status = 'pending' and admin_note = '');

drop policy if exists "Admins review ad requests" on public.ad_requests;
create policy "Admins review ad requests"
  on public.ad_requests for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

grant select, insert, update on public.ad_requests to authenticated;

notify pgrst, 'reload schema';
