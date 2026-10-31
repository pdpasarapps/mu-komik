-- Gerbang akses baca sisi server (Level A / soft paywall).
-- Jalankan di Supabase SQL Editor SETELAH schema.sql dan platform-settings.sql.
--
-- Yang diatur di sini:
--   1. Batas episode gratis untuk tamu disimpan di platform_settings (bisa diubah admin).
--   2. Riwayat baca tamu disimpan di guest_chapter_reads, bukan localStorage.
--   3. reader_chapter_access() memutuskan akses: pratinjau, VIP, batas tamu, dan urutan episode.
--   4. record_guest_chapter_read() mencatat progres tamu secara atomik (hanya service role).
--
-- Catatan: gambar halaman tetap publik di CDN (soft gate). Yang dikunci adalah metadata
-- halaman per episode dan alur baca di aplikasi.

alter table public.platform_settings
  add column if not exists guest_read_chapter_limit integer not null default 2;

alter table public.platform_settings
  drop constraint if exists platform_settings_guest_read_chapter_limit_check;
alter table public.platform_settings
  add constraint platform_settings_guest_read_chapter_limit_check
  check (guest_read_chapter_limit between 0 and 100);

create table if not exists public.guest_chapter_reads (
  visitor_id uuid not null,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  comic_id uuid not null references public.comics(id) on delete cascade,
  last_page integer not null default 0 check (last_page >= 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (visitor_id, chapter_id)
);

create index if not exists guest_chapter_reads_visitor_idx on public.guest_chapter_reads (visitor_id);
create index if not exists guest_chapter_reads_comic_idx on public.guest_chapter_reads (comic_id);

alter table public.guest_chapter_reads enable row level security;
-- Tidak ada policy: hanya route server (service role) dan fungsi security definer di bawah
-- yang boleh membaca/menulis tabel ini.
revoke all on table public.guest_chapter_reads from anon, authenticated;

create or replace function public.reader_chapter_access(
  p_comic_id uuid,
  p_chapter_id uuid,
  p_visitor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_comic public.comics%rowtype;
  v_chapter public.chapters%rowtype;
  v_user_id uuid := auth.uid();
  v_guest_limit integer := 2;
  v_guest_read_count integer := 0;
  v_guest_already_read boolean := false;
  v_vip boolean := false;
  v_preview boolean := false;
  v_index integer := -1;
  v_target_index integer := -1;
  v_first_incomplete_id uuid := null;
  v_first_incomplete_index integer := -1;
  v_last_page integer := 0;
  rec record;
begin
  select * into v_comic from public.comics where id = p_comic_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_found', 'guest_limit', 2);
  end if;

  select * into v_chapter
  from public.chapters
  where id = p_chapter_id and comic_id = p_comic_id;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_found', 'guest_limit', 2);
  end if;

  select coalesce(guest_read_chapter_limit, 2)
  into v_guest_limit
  from public.platform_settings
  where id = true;
  v_guest_limit := greatest(0, least(100, coalesce(v_guest_limit, 2)));

  if v_comic.status <> 'published' or v_chapter.published_at is null then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_user_id
        and (
          p.role = 'admin'
          or (
            p.is_staff
            and (
              p.staff_permissions @> array['comic-review']::text[]
              or p.staff_permissions @> array['kids-review']::text[]
            )
          )
        )
    ) into v_preview;
    if v_comic.creator_id = v_user_id then
      v_preview := true;
    end if;
    return jsonb_build_object(
      'allowed', coalesce(v_preview, false),
      'reason', case when coalesce(v_preview, false) then 'preview' else 'not_found' end,
      'guest_limit', v_guest_limit
    );
  end if;

  if v_user_id is not null then
    select exists (
      select 1
      from public.reader_memberships m
      where m.user_id = v_user_id
        and m.tier = 'vip'
        and (m.expires_at is null or m.expires_at > now())
    ) into v_vip;
    if v_vip then
      return jsonb_build_object('allowed', true, 'reason', 'vip', 'guest_limit', v_guest_limit);
    end if;
  end if;

  if v_user_id is null and not v_comic.guest_read_all_episodes then
    if v_guest_limit <= 0 then
      return jsonb_build_object('allowed', false, 'reason', 'login_required', 'guest_limit', v_guest_limit);
    end if;
    if p_visitor_id is not null then
      select count(*) into v_guest_read_count
      from public.guest_chapter_reads
      where visitor_id = p_visitor_id;
      select exists (
        select 1 from public.guest_chapter_reads
        where visitor_id = p_visitor_id and chapter_id = p_chapter_id
      ) into v_guest_already_read;
      if not v_guest_already_read and v_guest_read_count >= v_guest_limit then
        return jsonb_build_object('allowed', false, 'reason', 'guest_limit', 'guest_limit', v_guest_limit);
      end if;
    end if;
  end if;

  for rec in
    select c.id,
      (select count(*) from public.pages pg where pg.chapter_id = c.id) as page_count
    from public.chapters c
    where c.comic_id = p_comic_id and c.published_at is not null
    order by c.chapter_number asc, c.id asc
  loop
    v_index := v_index + 1;
    if rec.id = p_chapter_id then
      v_target_index := v_index;
    end if;
    if v_first_incomplete_id is null then
      v_last_page := 0;
      if v_user_id is not null then
        select h.last_page into v_last_page
        from public.reading_history h
        where h.user_id = v_user_id and h.chapter_id = rec.id;
      elsif p_visitor_id is not null then
        select g.last_page into v_last_page
        from public.guest_chapter_reads g
        where g.visitor_id = p_visitor_id and g.chapter_id = rec.id;
      end if;
      if coalesce(rec.page_count, 0) = 0 or coalesce(v_last_page, 0) < rec.page_count then
        v_first_incomplete_id := rec.id;
        v_first_incomplete_index := v_index;
      end if;
    end if;
  end loop;

  if v_target_index < 0 then
    return jsonb_build_object('allowed', false, 'reason', 'not_found', 'guest_limit', v_guest_limit);
  end if;

  if v_first_incomplete_id is not null and v_target_index > v_first_incomplete_index then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'locked',
      'redirect_chapter_id', v_first_incomplete_id,
      'guest_limit', v_guest_limit
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', case when v_user_id is null then 'guest' else 'sequential' end,
    'guest_limit', v_guest_limit
  );
end;
$$;

revoke all on function public.reader_chapter_access(uuid, uuid, uuid) from public;
grant execute on function public.reader_chapter_access(uuid, uuid, uuid) to anon, authenticated;

create or replace function public.record_guest_chapter_read(
  p_visitor_id uuid,
  p_chapter_id uuid,
  p_last_page integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chapter record;
  v_guest_limit integer := 2;
  v_read_count integer := 0;
  v_existing_last_page integer := null;
  v_max_page integer := 0;
  v_last_page integer := 0;
begin
  select c.id, c.comic_id, c.published_at, m.status as comic_status
  into v_chapter
  from public.chapters c
  join public.comics m on m.id = c.comic_id
  where c.id = p_chapter_id;

  if not found or v_chapter.comic_status <> 'published' or v_chapter.published_at is null then
    return jsonb_build_object('recorded', false, 'reason', 'not_found');
  end if;

  -- Serialisasi pendaftaran bersamaan untuk visitor yang sama.
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_id::text, 0));

  select coalesce(guest_read_chapter_limit, 2)
  into v_guest_limit
  from public.platform_settings
  where id = true;
  v_guest_limit := greatest(0, least(100, coalesce(v_guest_limit, 2)));

  select last_page into v_existing_last_page
  from public.guest_chapter_reads
  where visitor_id = p_visitor_id and chapter_id = p_chapter_id;

  if v_existing_last_page is null and v_guest_limit <= 0 then
    return jsonb_build_object('recorded', false, 'reason', 'login_required', 'guest_limit', v_guest_limit);
  end if;

  if v_existing_last_page is null then
    select count(*) into v_read_count
    from public.guest_chapter_reads
    where visitor_id = p_visitor_id;
    if v_read_count >= v_guest_limit then
      return jsonb_build_object('recorded', false, 'reason', 'guest_limit', 'guest_limit', v_guest_limit);
    end if;
  end if;

  select coalesce(max(page_number), 0) into v_max_page
  from public.pages
  where chapter_id = p_chapter_id;

  v_last_page := greatest(0, least(v_max_page, coalesce(p_last_page, 0)));

  insert into public.guest_chapter_reads (visitor_id, chapter_id, comic_id, last_page)
  values (p_visitor_id, p_chapter_id, v_chapter.comic_id, v_last_page)
  on conflict (visitor_id, chapter_id) do update
    set last_page = greatest(public.guest_chapter_reads.last_page, excluded.last_page),
        updated_at = now();

  return jsonb_build_object(
    'recorded', true,
    'first_time', v_existing_last_page is null,
    'guest_limit', v_guest_limit
  );
end;
$$;

revoke all on function public.record_guest_chapter_read(uuid, uuid, integer) from public;
revoke all on function public.record_guest_chapter_read(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.record_guest_chapter_read(uuid, uuid, integer) to service_role;

