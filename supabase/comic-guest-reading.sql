alter table public.comics
  add column if not exists guest_read_all_episodes boolean not null default false;
