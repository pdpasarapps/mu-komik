-- Run after supabase/staff-access.sql so staff section access is available.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 1 and 254),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;
grant all on public.contact_messages to service_role;
grant select on public.contact_messages to authenticated;
grant update (status, updated_at) on public.contact_messages to authenticated;

drop policy if exists "Staff view contact messages" on public.contact_messages;
create policy "Staff view contact messages"
on public.contact_messages for select
using (public.has_admin_section_access('contact-messages'));

drop policy if exists "Staff update contact messages" on public.contact_messages;
create policy "Staff update contact messages"
on public.contact_messages for update
using (public.has_admin_section_access('contact-messages'))
with check (public.has_admin_section_access('contact-messages'));
