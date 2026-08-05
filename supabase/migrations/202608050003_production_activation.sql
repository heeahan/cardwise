-- Production activation helpers. Additive, idempotent and safe for existing data.

create table if not exists public.account_deletion_audits (
  id uuid primary key default gen_random_uuid(),
  subject_hash char(64) not null,
  status text not null check (status in ('requested','storage_deleted','completed','failed')),
  storage_objects_deleted integer not null default 0 check (storage_objects_deleted >= 0),
  error_code text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists account_deletion_audits_one_active_subject_uidx
  on public.account_deletion_audits(subject_hash) where status in ('requested','storage_deleted');

alter table public.account_deletion_audits enable row level security;
alter table public.account_deletion_audits force row level security;
revoke all on table public.account_deletion_audits from public, anon, authenticated;

-- Only one live run per Provider. Completed, failed and not-configured history remains append-only.
with duplicate_running as (
  select id, row_number() over (partition by provider_id order by started_at desc, id desc) as position
  from public.catalog_sync_runs
  where status = 'running'
)
update public.catalog_sync_runs
set status = 'failed', finished_at = coalesce(finished_at, now()), error_summary = coalesce(error_summary, 'Reconciled duplicate running task during production activation')
where id in (select id from duplicate_running where position > 1);

create unique index if not exists catalog_sync_runs_one_running_provider_uidx
  on public.catalog_sync_runs(provider_id) where status = 'running';

create or replace function public.bootstrap_cardwise_admin(target_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  inserted_count integer := 0;
begin
  if target_user is null or target_user = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_USER_ID';
  end if;
  if not exists(select 1 from auth.users where id = target_user and email_confirmed_at is not null) then
    raise exception using errcode = 'P0001', message = 'ADMIN_USER_NOT_CONFIRMED';
  end if;

  insert into public.cardwise_admins(user_id, created_by)
  values (target_user, target_user)
  on conflict (user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 1 then
    insert into public.audit_logs(user_id, entity_type, entity_id, action, after_data)
    values (target_user, 'cardwise_admin', target_user, 'admin_bootstrap', jsonb_build_object('method','controlled_service_role_rpc'));
  end if;
  return inserted_count = 1;
end;
$$;

revoke all on function public.bootstrap_cardwise_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_cardwise_admin(uuid) to service_role;

create or replace function public.cardwise_production_readiness()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog, storage
as $$
declare
  required_tables text[] := array[
    'profiles','credit_cards','card_benefits','transactions','benefit_usages','uploaded_files','import_jobs',
    'audit_logs','cardwise_admins','card_catalog','catalog_benefits','catalog_sync_runs','catalog_source_documents',
    'catalog_change_events','user_catalog_updates','account_deletion_audits'
  ];
  missing_tables text[];
  rls_disabled text[];
  missing_functions text[] := '{}';
  bucket_row record;
  latest_sync jsonb;
begin
  if auth.role() <> 'service_role' and not public.is_cardwise_admin() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select coalesce(array_agg(name order by name), '{}') into missing_tables
  from unnest(required_tables) as required(name)
  where to_regclass('public.' || required.name) is null;

  select coalesce(array_agg(c.relname order by c.relname), '{}') into rls_disabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any(required_tables) and not c.relrowsecurity;

  if to_regprocedure('public.archive_credit_card(uuid)') is null then missing_functions := array_append(missing_functions, 'archive_credit_card'); end if;
  if to_regprocedure('public.restore_credit_card(uuid)') is null then missing_functions := array_append(missing_functions, 'restore_credit_card'); end if;
  if to_regprocedure('public.add_catalog_card_to_wallet(uuid,jsonb)') is null then missing_functions := array_append(missing_functions, 'add_catalog_card_to_wallet'); end if;
  if to_regprocedure('public.accept_catalog_update(uuid)') is null then missing_functions := array_append(missing_functions, 'accept_catalog_update'); end if;
  if to_regprocedure('public.bootstrap_cardwise_admin(uuid)') is null then missing_functions := array_append(missing_functions, 'bootstrap_cardwise_admin'); end if;

  select id, public, file_size_limit, allowed_mime_types into bucket_row from storage.buckets where id = 'cardwise-private';
  select jsonb_build_object('status', status, 'providerId', provider_id, 'startedAt', started_at, 'finishedAt', finished_at)
    into latest_sync from public.catalog_sync_runs order by started_at desc limit 1;

  return jsonb_build_object(
    'schemaVersion', '202608050003',
    'missingTables', missing_tables,
    'missingFunctions', missing_functions,
    'rlsDisabledTables', rls_disabled,
    'storage', jsonb_build_object(
      'exists', bucket_row.id is not null,
      'private', coalesce(not bucket_row.public, false),
      'fileSizeLimit', bucket_row.file_size_limit,
      'mimeTypesMatch', coalesce(bucket_row.allowed_mime_types @> array['image/jpeg','image/png','image/webp','application/pdf','text/csv','application/json']::text[] and bucket_row.allowed_mime_types <@ array['image/jpeg','image/png','image/webp','application/pdf','text/csv','application/json']::text[], false),
      'allowedMimeTypes', coalesce(to_jsonb(bucket_row.allowed_mime_types), '[]'::jsonb)
    ),
    'administratorCount', (select count(*) from public.cardwise_admins),
    'verifiedCatalogCount', (select count(*) from public.card_catalog where verification_status = 'verified' and deleted_at is null),
    'staleCatalogCount', (select count(*) from public.card_catalog where verification_status = 'verified' and deleted_at is null and (last_synced_at is null or last_synced_at < now() - interval '90 days')),
    'latestSync', latest_sync
  );
end;
$$;

revoke all on function public.cardwise_production_readiness() from public, anon;
grant execute on function public.cardwise_production_readiness() to authenticated, service_role;
