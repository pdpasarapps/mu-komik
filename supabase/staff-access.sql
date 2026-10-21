-- Jalankan setelah schema.sql dan semua migrasi tabel admin. Setelahnya,
-- jalankan ulang ad-requests.sql dan comic-analytics.sql agar RPC terkait
-- memakai pemeriksaan izin staf ini.
alter type public.user_role add value if not exists 'staff' after 'creator';

alter table public.profiles
  add column if not exists is_staff boolean not null default false,
  add column if not exists staff_title text not null default '',
  add column if not exists staff_permissions text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_staff_permissions_valid;
alter table public.profiles
  add constraint profiles_staff_permissions_valid check (
    staff_permissions <@ array[
      'overview', 'analytics', 'comic-review', 'kids-review', 'creator-requests',
      'users', 'admins', 'staf', 'readers', 'kreator', 'comics', 'articles',
      'share-previews', 'ad-requests', 'sponsor-campaigns', 'ad-slots',
      'homepage-promos', 'platform-settings'
    ]::text[]
  );

update public.profiles
set role = 'reader',
    is_staff = true,
    staff_title = coalesce(nullif(staff_title, ''), 'Staf'),
    staff_permissions = case when cardinality(staff_permissions) = 0 then array[
      'overview', 'comic-review', 'creator-requests', 'kreator', 'comics', 'articles'
    ]::text[] else staff_permissions end
where role::text = 'staff';

create or replace function public.has_admin_section_access(p_section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
    and (
      role = 'admin'
      or (is_staff and
        case p_section
          when 'ads-management' then 'sponsor-campaigns'
          when 'ads-list' then 'ad-slots'
          else p_section
        end = any(staff_permissions))
    )
  );
$$;

revoke all on function public.has_admin_section_access(text) from public;
grant execute on function public.has_admin_section_access(text) to authenticated;

drop policy if exists "Staff view permitted profiles" on public.profiles;
create policy "Staff view permitted profiles"
on public.profiles for select
using (
  public.has_admin_section_access('users')
  or (role = 'admin' and public.has_admin_section_access('admins'))
  or (is_staff and public.has_admin_section_access('staf'))
  or (role = 'reader' and public.has_admin_section_access('readers'))
  or (role = 'creator' and public.has_admin_section_access('kreator'))
  or (
    public.has_admin_section_access('creator-requests')
    and exists (
      select 1 from public.creator_requests
      where creator_requests.user_id = profiles.id
        and creator_requests.status = 'pending'
    )
  )
);

do $$
begin
  if to_regclass('public.comic_kids_curation') is not null then
    execute 'drop policy if exists "Staff review kids curation" on public.comic_kids_curation';
    execute 'drop policy if exists "Staff view kids curation queue" on public.comic_kids_curation';
    execute $policy$
      create policy "Staff review kids curation" on public.comic_kids_curation
      for update
      using (public.has_admin_section_access('kids-review'))
      with check (
        public.has_admin_section_access('kids-review')
        and (review_status = 'pending' or reviewed_at is not null)
      )
    $policy$;
    execute $policy$
      create policy "Staff view kids curation queue" on public.comic_kids_curation
      for select
      using (public.has_admin_section_access('kids-review'))
    $policy$;
  end if;

  if to_regclass('public.ad_slots') is not null then
    execute 'drop policy if exists "Staff manage ad slots" on public.ad_slots';
    execute $policy$
      create policy "Staff manage ad slots" on public.ad_slots for all
      using (public.has_admin_section_access('ad-slots'))
      with check (public.has_admin_section_access('ad-slots'))
    $policy$;
    execute 'drop policy if exists "Staff view ad slots for requests" on public.ad_slots';
    execute $policy$
      create policy "Staff view ad slots for requests" on public.ad_slots for select
      using (public.has_admin_section_access('ad-requests'))
    $policy$;
  end if;

  if to_regclass('public.sponsor_campaigns') is not null then
    execute 'drop policy if exists "Staff manage sponsor campaigns" on public.sponsor_campaigns';
    execute $policy$
      create policy "Staff manage sponsor campaigns" on public.sponsor_campaigns for all
      using (public.has_admin_section_access('sponsor-campaigns'))
      with check (public.has_admin_section_access('sponsor-campaigns'))
    $policy$;
  end if;

  if to_regclass('public.ad_requests') is not null then
    execute 'drop policy if exists "Staff view ad requests" on public.ad_requests';
    execute $policy$
      create policy "Staff view ad requests" on public.ad_requests for select
      using (public.has_admin_section_access('ad-requests'))
    $policy$;
    execute 'drop policy if exists "Staff review ad requests" on public.ad_requests';
    execute $policy$
      create policy "Staff review ad requests" on public.ad_requests for update
      using (public.has_admin_section_access('ad-requests'))
      with check (public.has_admin_section_access('ad-requests'))
    $policy$;
  end if;

  if to_regclass('public.homepage_promos') is not null then
    execute 'drop policy if exists "Staff manage homepage promos" on public.homepage_promos';
    execute $policy$
      create policy "Staff manage homepage promos" on public.homepage_promos for all
      using (public.has_admin_section_access('homepage-promos'))
      with check (public.has_admin_section_access('homepage-promos'))
    $policy$;
  end if;

  if to_regclass('public.platform_settings') is not null then
    execute 'drop policy if exists "Staff manage platform settings" on public.platform_settings';
    execute $policy$
      create policy "Staff manage platform settings" on public.platform_settings for all
      using (public.has_admin_section_access('platform-settings'))
      with check (public.has_admin_section_access('platform-settings'))
    $policy$;
  end if;

  if to_regclass('public.platform_settings_audit') is not null then
    execute 'drop policy if exists "Staff read platform settings audit" on public.platform_settings_audit';
    execute $policy$
      create policy "Staff read platform settings audit" on public.platform_settings_audit for select
      using (public.has_admin_section_access('platform-settings'))
    $policy$;
  end if;
end;
$$;

drop policy if exists "Staff view creator profiles" on public.profiles;
create policy "Staff view creator profiles"
on public.profiles for select
using (
  public.has_admin_section_access('kreator')
  and role = 'creator'
);

drop policy if exists "Staff view creator applicants" on public.profiles;
create policy "Staff view creator applicants"
on public.profiles for select
using (
  public.has_admin_section_access('creator-requests')
  and exists (
    select 1
    from public.creator_requests
    where creator_requests.user_id = profiles.id
      and creator_requests.status = 'pending'
  )
);

drop policy if exists "Staff view creator requests" on public.creator_requests;
create policy "Staff view creator requests"
on public.creator_requests for select
using (public.has_admin_section_access('creator-requests'));

drop policy if exists "Staff review creator requests" on public.creator_requests;

create or replace function public.review_creator_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  if not public.has_admin_section_access('creator-requests') then
    raise exception 'Insufficient permission to review creator requests';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid creator request decision';
  end if;

  update public.creator_requests
  set status = p_decision, reviewed_at = now()
  where id = p_request_id and status = 'pending'
  returning user_id into target_user_id;

  if target_user_id is null then
    raise exception 'Creator request is missing or no longer pending';
  end if;

  if p_decision = 'approved' then
    insert into private.staff_role_change_authorizations (transaction_id, user_id)
    values (txid_current(), target_user_id)
    on conflict do nothing;
    update public.profiles set role = 'creator' where id = target_user_id;
  end if;
end;
$$;

revoke all on function public.review_creator_request(uuid, text) from public;
grant execute on function public.review_creator_request(uuid, text) to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.staff_role_change_authorizations (
  transaction_id bigint not null,
  user_id uuid not null,
  primary key (transaction_id, user_id)
);
revoke all on table private.staff_role_change_authorizations from public, anon, authenticated;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and old.role is distinct from new.role
    and not public.is_admin()
    and not exists (
      select 1
      from private.staff_role_change_authorizations
      where transaction_id = txid_current()
        and user_id = old.id
    ) then
    raise exception 'Only an admin can change account roles';
  end if;
  delete from private.staff_role_change_authorizations
  where transaction_id = txid_current()
    and user_id = old.id;
  return new;
end;
$$;

create or replace function public.protect_profile_staff_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and (
      old.is_staff is distinct from new.is_staff
      or old.staff_title is distinct from new.staff_title
      or old.staff_permissions is distinct from new.staff_permissions
    )
    and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
    raise exception 'Only an admin can change staff access settings';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_staff_access on public.profiles;
create trigger protect_profile_staff_access
before update on public.profiles
for each row execute procedure public.protect_profile_staff_access();

drop policy if exists "Staff view comic submissions" on public.comics;
create policy "Staff view comic submissions"
on public.comics for select
using (
  public.has_admin_section_access('comic-review')
  or public.has_admin_section_access('comics')
  or public.has_admin_section_access('kids-review')
  or public.has_admin_section_access('share-previews')
);

create or replace function public.review_comic_submission(p_comic_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_section_access('comic-review') then
    raise exception 'Insufficient permission to review comics';
  end if;

  if p_decision not in ('published', 'draft') then
    raise exception 'Invalid comic review decision';
  end if;

  update public.comics
  set status = p_decision::public.comic_status
  where id = p_comic_id and status = 'pending_review';

  if not found then
    raise exception 'Comic is missing or no longer pending review';
  end if;
end;
$$;

revoke all on function public.review_comic_submission(uuid, text) from public;
grant execute on function public.review_comic_submission(uuid, text) to authenticated;

drop policy if exists "Staff manage articles" on public.articles;
create policy "Staff manage articles" on public.articles
for all to authenticated
using (public.has_admin_section_access('articles'))
with check (
  public.has_admin_section_access('articles')
);
