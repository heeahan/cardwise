-- Harden Auth profile provisioning without changing existing business schema or RLS.
-- Additive and safe to re-run after every environment promotion.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  resolved_display_name text;
begin
  resolved_display_name := coalesce(
    nullif(btrim(coalesce(new.raw_user_meta_data, '{}'::jsonb) ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'CardWise 用户'
  );

  insert into public.profiles(user_id, display_name)
  values (new.id, resolved_display_name)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Repair accounts created while an older or missing trigger was deployed.
insert into public.profiles(user_id, display_name)
select
  users.id,
  coalesce(
    nullif(btrim(coalesce(users.raw_user_meta_data, '{}'::jsonb) ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'CardWise 用户'
  )
from auth.users as users
left join public.profiles as profiles on profiles.user_id = users.id
where profiles.user_id is null
on conflict (user_id) do nothing;

comment on function public.handle_new_user() is 'Creates exactly one RLS-owned CardWise profile for each Supabase Auth user.';
