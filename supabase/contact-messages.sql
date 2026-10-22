-- Run after supabase/staff-access.sql so staff section access is available.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 1 and 254),
  category text not null default 'other',
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages
  add column if not exists category text,
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists read_at timestamptz;

alter table public.profiles
  add column if not exists staff_contact_categories text[] not null default '{}';

update public.contact_messages
set category = 'other'
where category is null;

alter table public.contact_messages
  alter column category set default 'other',
  alter column category set not null;

alter table public.contact_messages
  drop constraint if exists contact_messages_category_check;

alter table public.contact_messages
  add constraint contact_messages_category_check
  check (category in (
    'account_login', 'comic_reading', 'blocked_account', 'appeal', 'membership',
    'payment_tokens', 'payment_other', 'creator_publishing', 'content_report',
    'technical_issue', 'other'
  ));

alter table public.profiles
  drop constraint if exists profiles_staff_contact_categories_valid;
alter table public.profiles
  add constraint profiles_staff_contact_categories_valid check (
    staff_contact_categories <@ array[
      'account_login', 'comic_reading', 'blocked_account', 'appeal', 'membership',
      'payment_tokens', 'payment_other', 'creator_publishing', 'content_report',
      'technical_issue', 'other'
    ]::text[]
  );

update public.profiles
set staff_contact_categories = array[
  'account_login', 'comic_reading', 'blocked_account', 'appeal', 'membership',
  'payment_tokens', 'payment_other', 'creator_publishing', 'content_report',
  'technical_issue', 'other'
]::text[]
where is_staff
  and 'contact-messages' = any(staff_permissions)
  and cardinality(staff_contact_categories) = 0;

create or replace function public.has_admin_contact_category_access(p_category text)
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
      or (
        is_staff
        and public.has_admin_section_access('contact-messages')
        and p_category = any(staff_contact_categories)
      )
    )
  );
$$;

revoke all on function public.has_admin_contact_category_access(text) from public;
grant execute on function public.has_admin_contact_category_access(text) to authenticated;

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;
grant all on public.contact_messages to service_role;
grant select on public.contact_messages to authenticated;
grant update (status, updated_at, read_at) on public.contact_messages to authenticated;

drop policy if exists "Staff view contact messages" on public.contact_messages;
create policy "Staff view contact messages"
on public.contact_messages for select
using (public.has_admin_contact_category_access(category));

drop policy if exists "Staff update contact messages" on public.contact_messages;
create policy "Staff update contact messages"
on public.contact_messages for update
using (public.has_admin_contact_category_access(category))
with check (public.has_admin_contact_category_access(category));

create table if not exists public.account_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  message_type text not null check (message_type in ('private', 'system')),
  contact_message_id uuid references public.contact_messages(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists account_messages_recipient_created_idx
  on public.account_messages (recipient_id, created_at desc);

alter table public.account_messages enable row level security;
revoke all on public.account_messages from public, anon, authenticated;
grant select on public.account_messages to authenticated;
grant update (read_at) on public.account_messages to authenticated;
grant all on public.account_messages to service_role;

drop policy if exists "Users view own account messages" on public.account_messages;
create policy "Users view own account messages"
on public.account_messages for select
using (recipient_id = auth.uid());

drop policy if exists "Users mark own account messages read" on public.account_messages;
create policy "Users mark own account messages read"
on public.account_messages for update
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());
