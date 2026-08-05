-- CardWise initial schema. PostgreSQL / Supabase.
-- All money columns store integer minor currency units; KRW therefore stores whole won.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_language text not null default 'zh-CN',
  default_currency char(3) not null default 'KRW',
  default_timezone text not null default 'Asia/Seoul',
  email_notifications boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.card_issuers (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  name text not null, country_code char(2) not null default 'KR', slug text,
  is_public_template boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint issuer_owner_check check ((is_public_template and user_id is null) or (not is_public_template and user_id is not null))
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  issuer_id uuid references public.card_issuers(id), issuer_name text not null, card_name text not null, nickname text not null,
  network text not null check (network in ('Visa','Mastercard','AMEX','UnionPay','JCB','Local')),
  last_four char(4) check (last_four is null or last_four ~ '^\d{4}$'), color text not null default '#5d4de2', image_path text,
  opened_at date, status text not null default 'active' check (status in ('active','inactive','archived')),
  is_favorite boolean not null default false, sort_order integer not null default 0,
  annual_fee bigint not null default 0 check (annual_fee >= 0), annual_fee_month smallint check (annual_fee_month between 1 and 12),
  previous_month_spend_requirement bigint not null default 0 check (previous_month_spend_requirement >= 0),
  current_qualifying_spend bigint not null default 0 check (current_qualifying_spend >= 0),
  statement_cycle_day smallint check (statement_cycle_day between 1 and 31), notes text, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.benefit_categories (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
  slug text not null, name_zh_cn text not null, name_ko_kr text, name_en text, icon_key text not null default 'tag',
  parent_id uuid references public.benefit_categories(id), is_public_template boolean not null default false, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint category_owner_check check ((is_public_template and user_id is null) or (not is_public_template and user_id is not null))
);

create table public.card_benefits (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade, category_id uuid references public.benefit_categories(id),
  name text not null, category_slug text not null, subcategory text, description text not null,
  benefit_type text not null, rule jsonb not null, rule_version integer not null default 1,
  starts_at timestamptz, ends_at timestamptz, status text not null default 'active' check (status in ('active','upcoming','expiring','expired','unverified')),
  source_name text not null, source_url text, last_verified_at date, verified_by_user boolean not null default false,
  confidence text not null default 'needs_review' check (confidence in ('confirmed','needs_review','example')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint structured_rule_object check (jsonb_typeof(rule) = 'object')
);

create table public.benefit_merchants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  benefit_id uuid not null references public.card_benefits(id) on delete cascade, merchant_name text not null,
  keywords text[] not null default '{}', locale text, is_excluded boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id), occurred_at timestamptz not null, merchant_name text not null,
  category_slug text not null, original_amount bigint not null check (original_amount >= 0), currency char(3) not null default 'KRW',
  actual_discount_amount bigint not null default 0 check (actual_discount_amount >= 0), points_earned bigint not null default 0,
  external_fingerprint text, import_job_id uuid, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.benefit_usages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null, benefit_id uuid not null references public.card_benefits(id),
  card_id uuid not null references public.credit_cards(id), occurred_at timestamptz not null, usage_count integer not null default 1 check (usage_count >= 0),
  discount_amount bigint not null default 0 check (discount_amount >= 0), rule_snapshot jsonb not null, benefit_name_snapshot text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint usage_rule_snapshot_object check (jsonb_typeof(rule_snapshot) = 'object')
);

create table public.spend_requirements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.credit_cards(id) on delete cascade, period_start date not null, period_end date not null,
  required_amount bigint not null check (required_amount >= 0), qualifying_amount bigint not null default 0 check (qualifying_amount >= 0),
  is_satisfied boolean generated always as (qualifying_amount >= required_amount) stored, source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (user_id, card_id, period_start)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid references public.credit_cards(id) on delete cascade, benefit_id uuid references public.card_benefits(id) on delete cascade,
  reminder_type text not null, title text not null, body text not null, due_at timestamptz, is_enabled boolean not null default true,
  read_at timestamptz, dismissed_at timestamptz, delivery_channels text[] not null default '{in_app}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.uploaded_files (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null, original_name text not null, content_type text not null, size_bytes bigint not null check (size_bytes between 1 and 5242880),
  purpose text not null check (purpose in ('card_image','csv_import','benefit_source_image','benefit_source_pdf')),
  sha256 text, scan_status text not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  uploaded_file_id uuid references public.uploaded_files(id), status text not null default 'mapping' check (status in ('mapping','validating','ready','importing','completed','failed')),
  field_mapping jsonb not null default '{}', row_count integer not null default 0, imported_count integer not null default 0,
  skipped_count integer not null default 0, error_count integer not null default 0, errors jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

alter table public.transactions add constraint transactions_import_job_fk foreign key (import_job_id) references public.import_jobs(id) on delete set null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null, entity_id uuid, action text not null, before_data jsonb, after_data jsonb,
  request_id text, created_at timestamptz not null default now()
);

create index credit_cards_user_active_idx on public.credit_cards(user_id, status, sort_order) where deleted_at is null;
create index card_benefits_card_active_idx on public.card_benefits(card_id, status) where deleted_at is null;
create index card_benefits_user_category_idx on public.card_benefits(user_id, category_slug) where deleted_at is null;
create index benefit_merchants_keywords_idx on public.benefit_merchants using gin(keywords);
create index transactions_user_date_idx on public.transactions(user_id, occurred_at desc) where deleted_at is null;
create index transactions_user_merchant_idx on public.transactions(user_id, lower(merchant_name)) where deleted_at is null;
create unique index transactions_dedupe_idx on public.transactions(user_id, external_fingerprint) where external_fingerprint is not null and deleted_at is null;
create index benefit_usages_benefit_date_idx on public.benefit_usages(benefit_id, occurred_at desc) where deleted_at is null;
create index reminders_user_due_idx on public.reminders(user_id, due_at) where deleted_at is null and dismissed_at is null;
create index audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['profiles','card_issuers','credit_cards','benefit_categories','card_benefits','benefit_merchants','transactions','benefit_usages','spend_requirements','reminders','uploaded_files','import_jobs','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

create policy profiles_own_all on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy issuers_select_public_or_own on public.card_issuers for select using (is_public_template or user_id = auth.uid());
create policy issuers_insert_own on public.card_issuers for insert with check (user_id = auth.uid() and not is_public_template);
create policy issuers_update_own on public.card_issuers for update using (user_id = auth.uid()) with check (user_id = auth.uid() and not is_public_template);
create policy issuers_delete_own on public.card_issuers for delete using (user_id = auth.uid());
create policy categories_select_public_or_own on public.benefit_categories for select using (is_public_template or user_id = auth.uid());
create policy categories_insert_own on public.benefit_categories for insert with check (user_id = auth.uid() and not is_public_template);
create policy categories_update_own on public.benefit_categories for update using (user_id = auth.uid()) with check (user_id = auth.uid() and not is_public_template);
create policy categories_delete_own on public.benefit_categories for delete using (user_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['credit_cards','card_benefits','benefit_merchants','transactions','benefit_usages','spend_requirements','reminders','uploaded_files','import_jobs','audit_logs'] loop
    execute format('create policy %I on public.%I for select using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid())', t || '_delete_own', t);
  end loop;
end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(user_id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1))) on conflict do nothing; return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$ declare t text; begin
  foreach t in array array['profiles','card_issuers','credit_cards','benefit_categories','card_benefits','benefit_merchants','transactions','benefit_usages','spend_requirements','reminders','uploaded_files','import_jobs'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cardwise-private', 'cardwise-private', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf','text/csv'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy cardwise_storage_select_own on storage.objects for select using (bucket_id = 'cardwise-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cardwise_storage_insert_own on storage.objects for insert with check (bucket_id = 'cardwise-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cardwise_storage_update_own on storage.objects for update using (bucket_id = 'cardwise-private' and (storage.foldername(name))[1] = auth.uid()::text);
create policy cardwise_storage_delete_own on storage.objects for delete using (bucket_id = 'cardwise-private' and (storage.foldername(name))[1] = auth.uid()::text);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
