alter table public.reader_memberships
  add column if not exists expires_at timestamptz;

create table if not exists public.tripay_membership_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  merchant_ref text not null unique,
  tripay_reference text unique,
  payment_method text not null,
  payment_method_name text not null,
  amount integer not null check (amount = 25000),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUND')),
  previous_tier text check (previous_tier in ('free', 'premium', 'vip')),
  previous_expires_at timestamptz,
  granted_expires_at timestamptz,
  checkout_url text,
  pay_code text,
  qr_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tripay_membership_payments
  add column if not exists previous_tier text,
  add column if not exists previous_expires_at timestamptz,
  add column if not exists granted_expires_at timestamptz;

alter table public.tripay_membership_payments
  drop constraint if exists tripay_membership_payments_status_check;
alter table public.tripay_membership_payments
  add constraint tripay_membership_payments_status_check
  check (status in ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUND'));

create index if not exists tripay_membership_payments_user_created_idx
  on public.tripay_membership_payments (user_id, created_at desc);
create unique index if not exists tripay_membership_payments_one_pending_per_user_idx
  on public.tripay_membership_payments (user_id)
  where status = 'PENDING';

alter table public.tripay_membership_payments enable row level security;
revoke all on public.tripay_membership_payments from public, anon, authenticated;
grant select on public.tripay_membership_payments to authenticated;

drop policy if exists "Users view their own Tripay membership payments"
  on public.tripay_membership_payments;
create policy "Users view their own Tripay membership payments"
on public.tripay_membership_payments for select
using (user_id = auth.uid());

create or replace function public.complete_tripay_membership_payment(
  p_merchant_ref text,
  p_tripay_reference text,
  p_status text,
  p_total_amount integer,
  p_paid_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.tripay_membership_payments%rowtype;
  v_previous_tier text;
  v_previous_expires_at timestamptz;
  v_granted_expires_at timestamptz;
  v_refund_expires_at timestamptz;
begin
  if p_status not in ('PAID', 'EXPIRED', 'FAILED', 'REFUND')
    or p_merchant_ref is null
    or p_tripay_reference is null
    or p_total_amount is null then
    raise exception 'Invalid Tripay payment callback' using errcode = '22023';
  end if;

  select * into v_payment
  from public.tripay_membership_payments
  where merchant_ref = p_merchant_ref
  for update;
  if not found
    or (v_payment.tripay_reference is not null
      and v_payment.tripay_reference is distinct from p_tripay_reference)
    or p_total_amount < v_payment.amount then
    return false;
  end if;

  if p_status = 'REFUND' then
    if v_payment.status = 'REFUND' then
      return true;
    end if;
    if v_payment.status = 'PAID' then
      select tier, expires_at into v_previous_tier, v_previous_expires_at
      from public.reader_memberships
      where user_id = v_payment.user_id
      for update;
      if v_previous_tier = 'premium' and v_previous_expires_at is not null then
        if v_previous_expires_at = v_payment.granted_expires_at then
          update public.reader_memberships
          set tier = coalesce(v_payment.previous_tier, 'free'),
              expires_at = v_payment.previous_expires_at,
              updated_at = now()
          where user_id = v_payment.user_id;
        else
          v_refund_expires_at := v_previous_expires_at - interval '30 days';
          update public.reader_memberships
          set tier = case when v_refund_expires_at > now() then 'premium' else 'free' end,
              expires_at = v_refund_expires_at,
              updated_at = now()
          where user_id = v_payment.user_id;
        end if;
      end if;
    end if;
    update public.tripay_membership_payments
    set status = 'REFUND',
        tripay_reference = coalesce(tripay_reference, p_tripay_reference),
        updated_at = now()
    where id = v_payment.id;
    return true;
  end if;
  if v_payment.status = 'PAID' then
    return p_status = 'PAID';
  end if;
  if v_payment.status = 'REFUND' then
    return false;
  end if;
  if v_payment.status <> 'PENDING'
    and not (v_payment.status = 'EXPIRED' and p_status = 'PAID') then
    return v_payment.status = p_status;
  end if;

  if p_status = 'PAID' then
    select tier, expires_at into v_previous_tier, v_previous_expires_at
    from public.reader_memberships
    where user_id = v_payment.user_id
    for update;
    v_previous_tier := coalesce(v_previous_tier, 'free');
    v_granted_expires_at := case
      when v_previous_tier = 'vip' then v_previous_expires_at
      else greatest(coalesce(v_previous_expires_at, now()), now()) + interval '30 days'
    end;
  end if;

  update public.tripay_membership_payments
  set status = p_status,
      tripay_reference = coalesce(tripay_reference, p_tripay_reference),
      paid_at = case when p_status = 'PAID' then coalesce(p_paid_at, now()) else null end,
      previous_tier = case when p_status = 'PAID' then v_previous_tier else previous_tier end,
      previous_expires_at = case when p_status = 'PAID' then v_previous_expires_at else previous_expires_at end,
      granted_expires_at = case when p_status = 'PAID' then v_granted_expires_at else granted_expires_at end,
      updated_at = now()
  where id = v_payment.id;

  if p_status = 'PAID' then
    insert into public.reader_memberships (user_id, tier, expires_at, updated_at)
    values (v_payment.user_id, 'premium', v_granted_expires_at, now())
    on conflict (user_id) do update
    set tier = case
          when public.reader_memberships.tier = 'vip' then 'vip'
          else 'premium'
        end,
        expires_at = case
          when public.reader_memberships.tier = 'vip' then public.reader_memberships.expires_at
          else v_granted_expires_at
        end,
        updated_at = now();
  end if;

  return true;
end;
$$;

revoke all on function public.complete_tripay_membership_payment(text, text, text, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.complete_tripay_membership_payment(text, text, text, integer, timestamptz)
  to service_role;
