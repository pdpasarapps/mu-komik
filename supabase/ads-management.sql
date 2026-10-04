-- Run in Supabase SQL Editor to enable the admin ads and sponsor workspace.
create table if not exists public.ad_slots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  slot_key text not null unique check (slot_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  format text not null default 'banner' check (format in ('banner', 'native', 'sponsor')),
  description text not null default '' check (length(description) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_name text not null check (length(btrim(sponsor_name)) between 1 and 120),
  title text not null check (length(btrim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  destination_url text not null check (destination_url ~* '^https?://[^[:space:]]+$'),
  image_url text check (image_url is null or image_url ~* '^https?://[^[:space:]]+$'),
  slot_id uuid references public.ad_slots(id) on delete set null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsor_campaign_dates_valid check (ends_on >= starts_on),
  constraint active_sponsor_campaign_requires_slot check (status <> 'active' or slot_id is not null)
);

alter table public.sponsor_campaigns
  add column if not exists target_comic_id uuid references public.comics(id) on delete cascade;
alter table public.sponsor_campaigns
  add column if not exists target_placement text not null default 'all';
alter table public.sponsor_campaigns
  drop constraint if exists sponsor_campaign_target_placement_valid;
alter table public.sponsor_campaigns
  add constraint sponsor_campaign_target_placement_valid
  check (target_placement in ('all', 'comic_detail', 'reader', 'both'));
alter table public.sponsor_campaigns
  drop constraint if exists active_sponsor_campaign_requires_slot;
alter table public.sponsor_campaigns
  add constraint active_sponsor_campaign_requires_slot
  check (
    status <> 'active'
    or slot_id is not null
    or (target_comic_id is not null and target_placement in ('comic_detail', 'reader', 'both'))
  );
alter table public.sponsor_campaigns
  drop constraint if exists sponsor_campaign_target_is_exclusive;
alter table public.sponsor_campaigns
  add constraint sponsor_campaign_target_is_exclusive
  check (target_comic_id is null or slot_id is null);

create index if not exists sponsor_campaigns_slot_id_idx on public.sponsor_campaigns(slot_id);
create index if not exists sponsor_campaigns_status_dates_idx on public.sponsor_campaigns(status, starts_on, ends_on);
create index if not exists sponsor_campaigns_target_comic_idx on public.sponsor_campaigns(target_comic_id, status);

insert into public.ad_slots (name, slot_key, format, description)
values
  ('Banner beranda', 'home_banner', 'banner', 'Tampil setelah area komik pilihan di beranda.'),
  ('Sponsor detail komik', 'comic_detail_sponsor', 'sponsor', 'Tampil di halaman detail komik sebelum daftar episode.'),
  ('Iklan tengah bab', 'reader_mid_chapter', 'native', 'Tampil setelah halaman kelima pada halaman baca.')
on conflict (slot_key) do nothing;

alter table public.ad_slots enable row level security;
alter table public.sponsor_campaigns enable row level security;

drop policy if exists "Admins manage ad slots" on public.ad_slots;
create policy "Admins manage ad slots"
  on public.ad_slots for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins manage sponsor campaigns" on public.sponsor_campaigns;
create policy "Admins manage sponsor campaigns"
  on public.sponsor_campaigns for all
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

grant select, insert, update, delete on public.ad_slots to authenticated;
grant select, insert, update, delete on public.sponsor_campaigns to authenticated;

drop function if exists public.get_active_sponsor_campaign(text);
create or replace function public.get_active_sponsor_campaign(p_slot_key text, p_comic_id uuid default null)
returns table (
  campaign_id uuid,
  sponsor_name text,
  title text,
  description text,
  destination_url text,
  image_url text,
  format text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    campaign.id,
    campaign.sponsor_name,
    campaign.title,
    campaign.description,
    campaign.destination_url,
    campaign.image_url,
    slot.format
  from public.sponsor_campaigns as campaign
  join public.ad_slots as slot on slot.slot_key = p_slot_key
  where slot.slot_key = p_slot_key
    and slot.is_active
    and campaign.status = 'active'
    and (now() at time zone 'Asia/Jakarta')::date between campaign.starts_on and campaign.ends_on
    and (
      (campaign.target_comic_id is null and campaign.slot_id = slot.id)
      or (
        campaign.target_comic_id = p_comic_id
        and exists (
          select 1
          from public.comics as target_comic
          where target_comic.id = campaign.target_comic_id
            and target_comic.status = 'published'
        )
        and (
          (campaign.target_placement = 'comic_detail' and p_slot_key = 'comic_detail_sponsor')
          or (campaign.target_placement = 'reader' and p_slot_key = 'reader_mid_chapter')
          or (
            campaign.target_placement = 'both'
            and p_slot_key in ('comic_detail_sponsor', 'reader_mid_chapter')
          )
        )
      )
    )
  order by (campaign.target_comic_id = p_comic_id) desc, campaign.created_at desc
  limit 1;
$$;

revoke all on function public.get_active_sponsor_campaign(text, uuid) from public;
grant execute on function public.get_active_sponsor_campaign(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
