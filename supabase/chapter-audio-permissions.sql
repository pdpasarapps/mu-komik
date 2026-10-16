-- Jalankan setelah creator-request.sql dan admin-management.sql.
alter table public.profiles
  add column if not exists can_upload_audio boolean not null default false;

create or replace function public.protect_profile_audio_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and old.can_upload_audio is distinct from new.can_upload_audio
    and not exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
  then
    raise exception 'Only an admin can change creator audio access';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_audio_access on public.profiles;
create trigger protect_profile_audio_access
before update on public.profiles
for each row execute procedure public.protect_profile_audio_access();
