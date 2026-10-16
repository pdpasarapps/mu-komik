create table if not exists public.comic_kids_curation (
  comic_id uuid primary key references public.comics(id) on delete cascade,
  age_range text not null check (age_range in ('4_6', '7_9', '10_12')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text not null default '',
  check (
    (review_status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (review_status <> 'pending' and reviewed_at is not null)
  )
);

create index if not exists comic_kids_curation_review_queue_idx
  on public.comic_kids_curation(review_status, submitted_at);

alter table public.comic_kids_curation enable row level security;
grant select on public.comic_kids_curation to anon, authenticated;
grant insert, delete on public.comic_kids_curation to authenticated;
grant update on public.comic_kids_curation to authenticated;

drop policy if exists "Public can view approved kids comics" on public.comic_kids_curation;
drop policy if exists "Creators and admins view kids curation" on public.comic_kids_curation;
drop policy if exists "Creators request kids curation" on public.comic_kids_curation;
drop policy if exists "Creators remove rejected kids request" on public.comic_kids_curation;
drop policy if exists "Admins manage kids curation" on public.comic_kids_curation;

create policy "Public can view approved kids comics" on public.comic_kids_curation for select using (
  review_status = 'approved'
  and exists (
    select 1 from public.comics
    where comics.id = comic_kids_curation.comic_id and comics.status = 'published'
  )
);

create policy "Creators and admins view kids curation" on public.comic_kids_curation for select using (
  exists (
    select 1 from public.comics
    where comics.id = comic_kids_curation.comic_id and comics.creator_id = auth.uid()
  )
  or exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

create policy "Creators request kids curation" on public.comic_kids_curation for insert with check (
  review_status = 'pending' and reviewed_at is null and reviewed_by is null
  and exists (
    select 1 from public.comics
    where comics.id = comic_kids_curation.comic_id and comics.creator_id = auth.uid()
  )
);

create policy "Creators remove rejected kids request" on public.comic_kids_curation for delete using (
  review_status = 'rejected'
  and exists (
    select 1 from public.comics
    where comics.id = comic_kids_curation.comic_id and comics.creator_id = auth.uid()
  )
);

create policy "Admins manage kids curation" on public.comic_kids_curation for all
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  and (review_status = 'pending' or reviewed_at is not null)
);
