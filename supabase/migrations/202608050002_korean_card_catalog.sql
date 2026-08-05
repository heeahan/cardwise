-- Korean card catalog, reviewed source documents and versioned benefit sync.
-- This migration is additive; it never rewrites existing card or usage snapshots.

alter table public.card_issuers
  add column if not exists code text,
  add column if not exists name_ko text,
  add column if not exists name_en text,
  add column if not exists name_zh text,
  add column if not exists official_website text,
  add column if not exists logo_path text,
  add column if not exists is_active boolean not null default true;

update public.card_issuers set name_ko = coalesce(name_ko, name) where name_ko is null;
create unique index if not exists card_issuers_public_code_uidx on public.card_issuers(code) where code is not null and is_public_template and deleted_at is null;

create table public.cardwise_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create or replace function public.is_cardwise_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.cardwise_admins where user_id = auth.uid());
$$;

create table public.card_catalog (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid references public.card_issuers(id),
  provider_id text not null check (provider_id in ('coocon','public-data','manual')),
  external_card_id text not null,
  normalized_name text not null,
  name_ko text not null,
  name_en text,
  name_zh text,
  card_type text not null check (card_type in ('credit','debit')),
  brand text not null check (brand in ('Visa','Mastercard','AMEX','UnionPay','JCB','Local')),
  annual_fee_domestic bigint not null default 0 check (annual_fee_domestic >= 0),
  annual_fee_overseas bigint check (annual_fee_overseas is null or annual_fee_overseas >= 0),
  currency char(3) not null default 'KRW',
  image_url text,
  official_url text not null,
  application_url text,
  product_status text not null default 'unknown' check (product_status in ('active','suspended','discontinued','unknown')),
  source_url text not null,
  source_name text not null,
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  verification_status text not null default 'needs_review' check (verification_status in ('unverified','needs_review','verified','outdated','conflicted')),
  coverage_note text,
  source_fingerprint text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(provider_id, external_card_id)
);

create table public.catalog_benefits (
  id uuid primary key default gen_random_uuid(),
  catalog_card_id uuid not null references public.card_catalog(id) on delete cascade,
  provider_benefit_id text not null,
  name text not null,
  description text not null,
  category text not null,
  rule jsonb not null,
  source_text text not null,
  source_url text,
  effective_from date,
  effective_to date,
  source_updated_at timestamptz,
  verification_status text not null default 'needs_review' check (verification_status in ('unverified','needs_review','verified','outdated','conflicted')),
  review_reasons text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  is_current boolean not null default true,
  source_fingerprint text,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint catalog_benefit_rule_object check (jsonb_typeof(rule) = 'object'),
  unique(catalog_card_id, provider_benefit_id, version)
);

create table public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null check (provider_id in ('coocon','public-data','manual')),
  idempotency_key text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','completed','partial','failed','not_configured')),
  fetched_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  conflicted_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  cursor text,
  trigger_type text not null check (trigger_type in ('admin','cron','manual_import')),
  request_id text,
  created_at timestamptz not null default now(),
  unique(provider_id, idempotency_key)
);

create table public.catalog_source_documents (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references auth.users(id),
  catalog_card_id uuid references public.card_catalog(id) on delete set null,
  storage_path text not null unique,
  original_name text not null,
  content_type text not null check (content_type in ('application/pdf','text/csv','application/json')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  official_url text,
  source_name text not null,
  published_at date,
  effective_from date,
  effective_to date,
  parse_status text not null default 'needs_review' check (parse_status in ('uploaded','needs_review','reviewed','rejected','failed')),
  extracted_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.catalog_change_events (
  id uuid primary key default gen_random_uuid(),
  catalog_card_id uuid not null references public.card_catalog(id) on delete cascade,
  provider_benefit_id text,
  previous_benefit_id uuid references public.catalog_benefits(id),
  new_benefit_id uuid references public.catalog_benefits(id),
  change_type text not null check (change_type in ('card_updated','benefit_added','benefit_changed','benefit_removed','product_discontinued')),
  material_fields text[] not null default '{}',
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table public.user_catalog_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  change_event_id uuid not null references public.catalog_change_events(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','dismissed')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, credit_card_id, change_event_id)
);

alter table public.credit_cards
  add column if not exists catalog_card_id uuid references public.card_catalog(id),
  add column if not exists catalog_snapshot jsonb,
  add column if not exists catalog_synced_at timestamptz,
  add column if not exists auto_sync_enabled boolean not null default true;

alter table public.card_benefits
  add column if not exists catalog_benefit_id uuid references public.catalog_benefits(id),
  add column if not exists catalog_benefit_key text,
  add column if not exists catalog_benefit_version integer,
  add column if not exists catalog_source_snapshot jsonb;

create index card_catalog_issuer_idx on public.card_catalog(issuer_id) where deleted_at is null;
create index card_catalog_name_idx on public.card_catalog(normalized_name) where deleted_at is null;
create index card_catalog_status_idx on public.card_catalog(product_status, verification_status) where deleted_at is null;
create index card_catalog_synced_idx on public.card_catalog(last_synced_at) where deleted_at is null;
create index catalog_benefits_card_idx on public.catalog_benefits(catalog_card_id, verification_status, version desc) where deleted_at is null;
create unique index catalog_benefits_current_uidx on public.catalog_benefits(catalog_card_id, provider_benefit_id) where is_current and deleted_at is null;
create index catalog_sync_runs_provider_idx on public.catalog_sync_runs(provider_id, started_at desc);
create index catalog_change_events_card_idx on public.catalog_change_events(catalog_card_id, created_at desc);
create index user_catalog_updates_pending_idx on public.user_catalog_updates(user_id, status, created_at desc);
create unique index credit_cards_catalog_physical_uidx on public.credit_cards(user_id, catalog_card_id, coalesce(last_four, '')) where catalog_card_id is not null and deleted_at is null;

do $$ declare table_name text; begin
  foreach table_name in array array['cardwise_admins','card_catalog','catalog_benefits','catalog_sync_runs','catalog_source_documents','catalog_change_events','user_catalog_updates'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

create policy card_catalog_verified_read on public.card_catalog for select to authenticated
using ((verification_status = 'verified' and deleted_at is null) or public.is_cardwise_admin());
create policy card_catalog_admin_insert on public.card_catalog for insert to authenticated with check (public.is_cardwise_admin());
create policy card_catalog_admin_update on public.card_catalog for update to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy card_catalog_admin_delete on public.card_catalog for delete to authenticated using (public.is_cardwise_admin());

create policy catalog_benefits_verified_read on public.catalog_benefits for select to authenticated
using (((verification_status = 'verified' and deleted_at is null) and exists(select 1 from public.card_catalog c where c.id = catalog_card_id and c.verification_status = 'verified' and c.deleted_at is null)) or public.is_cardwise_admin());
create policy catalog_benefits_admin_insert on public.catalog_benefits for insert to authenticated with check (public.is_cardwise_admin());
create policy catalog_benefits_admin_update on public.catalog_benefits for update to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy catalog_benefits_admin_delete on public.catalog_benefits for delete to authenticated using (public.is_cardwise_admin());

create policy catalog_sync_runs_admin_all on public.catalog_sync_runs for all to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy catalog_source_documents_admin_all on public.catalog_source_documents for all to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy catalog_change_events_admin_read on public.catalog_change_events for select to authenticated using (public.is_cardwise_admin());
create policy catalog_change_events_holder_read on public.catalog_change_events for select to authenticated using (
  exists(select 1 from public.user_catalog_updates u where u.change_event_id = id and u.user_id = auth.uid())
);
create policy catalog_change_events_admin_write on public.catalog_change_events for all to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy user_catalog_updates_own_read on public.user_catalog_updates for select to authenticated using (user_id = auth.uid());
create policy user_catalog_updates_own_update on public.user_catalog_updates for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_catalog_updates_admin_all on public.user_catalog_updates for all to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy issuers_admin_insert on public.card_issuers for insert to authenticated with check (public.is_cardwise_admin());
create policy issuers_admin_update on public.card_issuers for update to authenticated using (public.is_cardwise_admin()) with check (public.is_cardwise_admin());
create policy credit_cards_admin_catalog_read on public.credit_cards for select to authenticated using (public.is_cardwise_admin() and catalog_card_id is not null);

create or replace function public.add_catalog_card_to_wallet(target_catalog_card uuid, options jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare catalog_row public.card_catalog%rowtype; issuer_row public.card_issuers%rowtype; benefit_row public.catalog_benefits%rowtype; new_card_id uuid; nickname_value text; network_value text; last_four_value text;
begin
  select * into catalog_row from public.card_catalog where id = target_catalog_card and verification_status = 'verified' and deleted_at is null;
  if not found then return null; end if;
  select * into issuer_row from public.card_issuers where id = catalog_row.issuer_id;
  nickname_value := trim(coalesce(options->>'nickname', catalog_row.name_ko));
  network_value := coalesce(nullif(options->>'network',''), catalog_row.brand);
  last_four_value := nullif(options->>'lastFour','');
  if nickname_value = '' or length(nickname_value) > 60 then raise exception 'INVALID_NICKNAME'; end if;
  if network_value not in ('Visa','Mastercard','AMEX','UnionPay','JCB','Local') then raise exception 'INVALID_NETWORK'; end if;
  if last_four_value is not null and last_four_value !~ '^\d{4}$' then raise exception 'INVALID_LAST_FOUR'; end if;

  insert into public.credit_cards(user_id, issuer_id, issuer_name, card_name, nickname, network, last_four, annual_fee, annual_fee_month, previous_month_spend_requirement, currency, statement_cycle_day, color, is_favorite, status, catalog_card_id, catalog_snapshot, catalog_synced_at, auto_sync_enabled)
  values(auth.uid(), catalog_row.issuer_id, coalesce(issuer_row.name_ko, issuer_row.name, catalog_row.source_name), catalog_row.name_ko, nickname_value, network_value, last_four_value, coalesce(catalog_row.annual_fee_overseas, catalog_row.annual_fee_domestic), 1, 0, catalog_row.currency, nullif(options->>'statementCycleDay','')::smallint, '#5d4de2', coalesce((options->>'isFavorite')::boolean, false), 'active', catalog_row.id,
    jsonb_build_object('catalogCardId',catalog_row.id,'providerId',catalog_row.provider_id,'externalCardId',catalog_row.external_card_id,'nameKo',catalog_row.name_ko,'issuerNameKo',coalesce(issuer_row.name_ko,issuer_row.name),'brand',catalog_row.brand,'annualFeeDomestic',catalog_row.annual_fee_domestic,'annualFeeOverseas',catalog_row.annual_fee_overseas,'sourceUrl',catalog_row.source_url,'sourceUpdatedAt',catalog_row.source_updated_at,'capturedAt',now()),
    now(), coalesce((options->>'autoSyncEnabled')::boolean, true)) returning id into new_card_id;

  for benefit_row in select * from public.catalog_benefits where catalog_card_id = catalog_row.id and is_current and verification_status = 'verified' and deleted_at is null loop
    insert into public.card_benefits(user_id, card_id, name, category_slug, description, benefit_type, rule, rule_version, starts_at, ends_at, status, source_name, source_url, last_verified_at, verified_by_user, confidence, catalog_benefit_id, catalog_benefit_key, catalog_benefit_version, catalog_source_snapshot)
    values(auth.uid(), new_card_id, benefit_row.name, benefit_row.category, benefit_row.description, benefit_row.rule->>'benefitType', benefit_row.rule, benefit_row.version, benefit_row.effective_from, benefit_row.effective_to, 'active', catalog_row.source_name, benefit_row.source_url, coalesce(benefit_row.source_updated_at::date, current_date), true, 'confirmed', benefit_row.id, benefit_row.provider_benefit_id, benefit_row.version,
      jsonb_build_object('catalogBenefitId',benefit_row.id,'version',benefit_row.version,'sourceText',benefit_row.source_text,'sourceUrl',benefit_row.source_url,'capturedAt',now()));
  end loop;
  insert into public.audit_logs(user_id, entity_type, entity_id, action, after_data) values(auth.uid(), 'credit_card', new_card_id, 'add_from_catalog', jsonb_build_object('catalogCardId', catalog_row.id));
  return new_card_id;
exception when unique_violation then raise exception 'DUPLICATE_CATALOG_CARD';
end; $$;

create or replace function public.accept_catalog_update(target_update uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare update_row public.user_catalog_updates%rowtype; event_row public.catalog_change_events%rowtype; benefit_row public.catalog_benefits%rowtype; new_benefit_id uuid;
begin
  select * into update_row from public.user_catalog_updates where id = target_update and user_id = auth.uid() and status = 'pending' for update;
  if not found then return null; end if;
  select * into event_row from public.catalog_change_events where id = update_row.change_event_id;
  if event_row.new_benefit_id is null then
    update public.user_catalog_updates set status = 'accepted', reviewed_at = now() where id = target_update;
    return update_row.credit_card_id;
  end if;
  select * into benefit_row from public.catalog_benefits where id = event_row.new_benefit_id and verification_status = 'verified' and is_current;
  if not found then raise exception 'CATALOG_BENEFIT_NOT_VERIFIED'; end if;
  update public.card_benefits set status = 'expired', ends_at = coalesce(ends_at, now()) where user_id = auth.uid() and card_id = update_row.credit_card_id and catalog_benefit_key = benefit_row.provider_benefit_id and status <> 'expired';
  insert into public.card_benefits(user_id, card_id, name, category_slug, description, benefit_type, rule, rule_version, starts_at, ends_at, status, source_name, source_url, last_verified_at, verified_by_user, confidence, catalog_benefit_id, catalog_benefit_key, catalog_benefit_version, catalog_source_snapshot)
  select auth.uid(), update_row.credit_card_id, benefit_row.name, benefit_row.category, benefit_row.description, benefit_row.rule->>'benefitType', benefit_row.rule, benefit_row.version, benefit_row.effective_from, benefit_row.effective_to, 'active', c.source_name, benefit_row.source_url, coalesce(benefit_row.source_updated_at::date,current_date), true, 'confirmed', benefit_row.id, benefit_row.provider_benefit_id, benefit_row.version, jsonb_build_object('catalogBenefitId',benefit_row.id,'version',benefit_row.version,'sourceText',benefit_row.source_text,'capturedAt',now()) from public.card_catalog c where c.id = benefit_row.catalog_card_id returning id into new_benefit_id;
  update public.user_catalog_updates set status = 'accepted', reviewed_at = now() where id = target_update;
  update public.credit_cards set catalog_synced_at = now() where id = update_row.credit_card_id and user_id = auth.uid();
  insert into public.audit_logs(user_id, entity_type, entity_id, action, after_data) values(auth.uid(), 'card_benefit', new_benefit_id, 'accept_catalog_update', jsonb_build_object('updateId',target_update));
  return new_benefit_id;
end; $$;

do $$ declare table_name text; begin
  foreach table_name in array array['card_catalog','catalog_benefits','catalog_source_documents'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_set_updated_at', table_name);
  end loop;
end $$;

revoke all on table public.cardwise_admins from anon, authenticated;
revoke all on table public.card_catalog from anon, authenticated;
revoke all on table public.catalog_benefits from anon, authenticated;
grant select(id,issuer_id,provider_id,external_card_id,normalized_name,name_ko,name_en,name_zh,card_type,brand,annual_fee_domestic,annual_fee_overseas,currency,image_url,official_url,application_url,product_status,source_url,source_name,source_updated_at,last_synced_at,verification_status,coverage_note,source_fingerprint,created_at,updated_at,deleted_at) on public.card_catalog to authenticated;
grant select(id,catalog_card_id,provider_benefit_id,name,description,category,rule,source_text,source_url,effective_from,effective_to,source_updated_at,verification_status,review_reasons,version,is_current,source_fingerprint,created_at,updated_at,deleted_at) on public.catalog_benefits to authenticated;
grant insert, update, delete on public.card_catalog, public.catalog_benefits to authenticated;
grant select, insert, update, delete on public.catalog_sync_runs, public.catalog_source_documents, public.catalog_change_events, public.user_catalog_updates to authenticated;
revoke all on function public.is_cardwise_admin() from public, anon;
revoke all on function public.add_catalog_card_to_wallet(uuid,jsonb) from public, anon;
revoke all on function public.accept_catalog_update(uuid) from public, anon;
grant execute on function public.is_cardwise_admin() to authenticated;
grant execute on function public.add_catalog_card_to_wallet(uuid,jsonb) to authenticated;
grant execute on function public.accept_catalog_update(uuid) to authenticated;

update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf','text/csv','application/json'] where id = 'cardwise-private';
