-- Additive production hardening for card lifecycle management.
alter table public.credit_cards
  add column if not exists currency char(3) not null default 'KRW',
  add column if not exists status_before_archive text check (status_before_archive in ('active','inactive'));

alter table public.card_benefits
  add column if not exists status_before_archive text check (status_before_archive in ('active','upcoming','expiring','expired','unverified'));

create or replace function public.archive_credit_card(target_id uuid)
returns timestamptz language plpgsql security invoker set search_path = public as $$
declare archived_at timestamptz := clock_timestamp(); affected integer;
begin
  update public.credit_cards
  set status_before_archive = status, status = 'archived', deleted_at = archived_at
  where id = target_id and user_id = auth.uid() and deleted_at is null;
  get diagnostics affected = row_count;
  if affected = 0 then return null; end if;

  update public.card_benefits
  set status_before_archive = status, status = 'expired', deleted_at = archived_at
  where card_id = target_id and user_id = auth.uid() and deleted_at is null;
  update public.transactions set deleted_at = archived_at
  where card_id = target_id and user_id = auth.uid() and deleted_at is null;
  update public.benefit_usages set deleted_at = archived_at
  where card_id = target_id and user_id = auth.uid() and deleted_at is null;
  insert into public.audit_logs(user_id, entity_type, entity_id, action)
  values (auth.uid(), 'credit_card', target_id, 'archive');
  return archived_at;
end; $$;

create or replace function public.restore_credit_card(target_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare archived_at timestamptz; affected integer;
begin
  select deleted_at into archived_at from public.credit_cards
  where id = target_id and user_id = auth.uid() and deleted_at is not null for update;
  if archived_at is null then return false; end if;

  update public.credit_cards
  set status = coalesce(status_before_archive, 'inactive'), status_before_archive = null, deleted_at = null
  where id = target_id and user_id = auth.uid();
  get diagnostics affected = row_count;
  if affected = 0 then return false; end if;
  update public.card_benefits
  set status = coalesce(status_before_archive, 'unverified'), status_before_archive = null, deleted_at = null
  where card_id = target_id and user_id = auth.uid() and deleted_at = archived_at;
  update public.transactions set deleted_at = null
  where card_id = target_id and user_id = auth.uid() and deleted_at = archived_at;
  update public.benefit_usages set deleted_at = null
  where card_id = target_id and user_id = auth.uid() and deleted_at = archived_at;
  insert into public.audit_logs(user_id, entity_type, entity_id, action)
  values (auth.uid(), 'credit_card', target_id, 'restore');
  return true;
end; $$;

revoke all on function public.archive_credit_card(uuid) from public, anon;
revoke all on function public.restore_credit_card(uuid) from public, anon;
grant execute on function public.archive_credit_card(uuid) to authenticated;
grant execute on function public.restore_credit_card(uuid) to authenticated;
