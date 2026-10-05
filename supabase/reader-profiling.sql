-- Run after supabase/ads-management.sql to enable reader interests and audience targeting.
create table if not exists public.reader_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_genres text[] not null default '{}',
  personalized_ads_consent boolean not null default false,
  consent_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint reader_preferences_genres_valid check (
    cardinality(preferred_genres) <= 5
    and preferred_genres <@ array[
      'Fantasy', 'Sci-fi', 'Drama', 'Comedy', 'Action', 'Romance', 'Horror',
      'Mystery', 'Thriller', 'Adventure', 'Slice of Life', 'Supernatural',
      'Historical', 'Sports', 'Kids', 'Inspirational'
    ]::text[]
  )
);

alter table public.reader_preferences enable row level security;
revoke all on public.reader_preferences from public, anon;
grant select, insert, update on public.reader_preferences to authenticated;

drop policy if exists "Readers view own preferences" on public.reader_preferences;
create policy "Readers view own preferences"
  on public.reader_preferences for select
  using (user_id = auth.uid());

drop policy if exists "Readers create own preferences" on public.reader_preferences;
create policy "Readers create own preferences"
  on public.reader_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists "Readers update own preferences" on public.reader_preferences;
create policy "Readers update own preferences"
  on public.reader_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.create_reader_preferences()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_genres text[] := '{}';
  v_allowed_genres text[] := array[
    'Fantasy', 'Sci-fi', 'Drama', 'Comedy', 'Action', 'Romance', 'Horror',
    'Mystery', 'Thriller', 'Adventure', 'Slice of Life', 'Supernatural',
    'Historical', 'Sports', 'Kids', 'Inspirational'
  ];
  v_consent boolean := coalesce(new.raw_user_meta_data->>'personalized_ads_consent', 'false') = 'true';
begin
  if jsonb_typeof(new.raw_user_meta_data->'preferred_genres') = 'array' then
    select coalesce(array_agg(submitted.genre order by submitted.genre), '{}')
    into v_genres
    from (
      select distinct genre
      from jsonb_array_elements_text(new.raw_user_meta_data->'preferred_genres') as submitted_values(genre)
      where genre = any(v_allowed_genres)
      order by genre
      limit 5
    ) as submitted;
  end if;

  insert into public.reader_preferences (
    user_id,
    preferred_genres,
    personalized_ads_consent,
    consent_updated_at
  )
  values (
    new.id,
    v_genres,
    v_consent,
    statement_timestamp()
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_reader_preferences() from public, anon, authenticated;
drop trigger if exists create_reader_preferences_on_signup on auth.users;
create trigger create_reader_preferences_on_signup
  after insert on auth.users
  for each row execute procedure public.create_reader_preferences();

insert into public.reader_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.sponsor_campaigns
  add column if not exists target_genres text[] not null default '{}';
alter table public.sponsor_campaigns
  drop constraint if exists sponsor_campaign_target_genres_valid;
alter table public.sponsor_campaigns
  add constraint sponsor_campaign_target_genres_valid
  check (
    cardinality(target_genres) <= 16
    and target_genres <@ array[
      'Fantasy', 'Sci-fi', 'Drama', 'Comedy', 'Action', 'Romance', 'Horror',
      'Mystery', 'Thriller', 'Adventure', 'Slice of Life', 'Supernatural',
      'Historical', 'Sports', 'Kids', 'Inspirational'
    ]::text[]
  );
create index if not exists sponsor_campaigns_target_genres_idx
  on public.sponsor_campaigns using gin (target_genres);

drop function if exists public.get_active_sponsor_campaign(text);
drop function if exists public.get_active_sponsor_campaign(text, uuid);
create or replace function public.get_active_sponsor_campaign(p_slot_key text, p_comic_id uuid default null)
returns table (
  campaign_id uuid,
  sponsor_name text,
  title text,
  description text,
  destination_url text,
  image_url text,
  image_url_tablet text,
  image_url_mobile text,
  format text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    campaign.id,
    campaign.sponsor_name,
    campaign.title,
    campaign.description,
    campaign.destination_url,
    campaign.image_url,
    campaign.image_url_tablet,
    campaign.image_url_mobile,
    slot.format
  from public.sponsor_campaigns as campaign
  join public.ad_slots as slot on slot.slot_key = p_slot_key
  where slot.slot_key = p_slot_key
    and slot.is_active
    and campaign.status = 'active'
    and (statement_timestamp() at time zone 'Asia/Jakarta')::date between campaign.starts_on and campaign.ends_on
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
          or (campaign.target_placement = 'episode_transition' and p_slot_key = 'reader_episode_transition')
          or (
            campaign.target_placement = 'both'
            and p_slot_key in ('comic_detail_sponsor', 'reader_mid_chapter')
          )
        )
      )
    )
    and (
      cardinality(campaign.target_genres) = 0
      or exists (
        select 1
        from public.comics as contextual_comic
        where contextual_comic.id = p_comic_id
          and contextual_comic.status = 'published'
          and contextual_comic.genre = any(campaign.target_genres)
      )
      or (
        auth.uid() is not null
        and exists (
          select 1
          from public.reader_preferences as preferences
          where preferences.user_id = auth.uid()
            and preferences.personalized_ads_consent
            and preferences.preferred_genres && campaign.target_genres
        )
      )
    )
  order by
    (campaign.target_comic_id = p_comic_id) desc,
    (cardinality(campaign.target_genres) > 0) desc,
    campaign.created_at desc
  limit 1;
$$;

revoke all on function public.get_active_sponsor_campaign(text, uuid) from public;
grant execute on function public.get_active_sponsor_campaign(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
