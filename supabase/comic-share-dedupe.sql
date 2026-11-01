-- Jalankan setelah supabase/comic-engagement-counts.sql.
-- Mencegah angka share digelembungkan: satu share per pengunjung per komik per hari
-- (bucket harian UTC), plus batas laju 20 share per pengunjung per jam.

alter table public.comic_share_events
  add column if not exists visitor_id uuid,
  add column if not exists share_bucket date;

create unique index if not exists comic_share_events_dedupe_idx
  on public.comic_share_events (comic_id, visitor_id, share_bucket);

create index if not exists comic_share_events_visitor_recent_idx
  on public.comic_share_events (visitor_id, created_at desc);

drop function if exists public.record_comic_share(uuid);

create or replace function public.record_comic_share(p_comic_id uuid, p_visitor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_bucket date := (statement_timestamp() at time zone 'UTC')::date;
  v_recent bigint;
  v_rows integer;
begin
  if p_comic_id is null or p_visitor_id is null then
    raise exception 'Comic and visitor IDs are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.comics
    where comics.id = p_comic_id and comics.status = 'published'
  ) then
    raise exception 'Published comic does not exist' using errcode = '22023';
  end if;

  select count(*) into v_recent
  from public.comic_share_events as event
  where event.visitor_id = p_visitor_id
    and event.created_at >= statement_timestamp() - interval '1 hour';

  if v_recent >= 20 then
    return jsonb_build_object('recorded', false, 'reason', 'rate_limited');
  end if;

  insert into public.comic_share_events (comic_id, visitor_id, share_bucket)
  values (p_comic_id, p_visitor_id, v_bucket)
  on conflict (comic_id, visitor_id, share_bucket) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('recorded', false, 'reason', 'duplicate');
  end if;

  return jsonb_build_object('recorded', true, 'reason', 'ok');
end;
$$;

revoke all on function public.record_comic_share(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_comic_share(uuid, uuid) to service_role;
