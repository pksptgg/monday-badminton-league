-- Rate-limit admin PIN checks so the 6-digit PIN cannot be brute-forced.
-- 5 wrong PINs from the same client IP within 15 minutes locks that IP for 15 minutes.
-- A correct PIN clears the counter for that IP.

create table if not exists public.admin_pin_attempts (
  client_ip text primary key,
  failures integer not null default 0,
  first_failed_at timestamptz not null default now(),
  locked_until timestamptz
);

-- No policies: anon/authenticated cannot read or write this table directly.
alter table public.admin_pin_attempts enable row level security;
revoke all on table public.admin_pin_attempts from anon, authenticated;

create or replace function public.request_client_ip()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
$$;

create or replace function public.verify_admin_pin(input_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ip text := public.request_client_ip();
  attempt public.admin_pin_attempts%rowtype;
  ok boolean;
begin
  select * into attempt from public.admin_pin_attempts where client_ip = ip;
  if found and attempt.locked_until is not null and attempt.locked_until > now() then
    raise exception 'Terlalu banyak cubaan PIN salah. Cuba lagi selepas % minit.',
      greatest(1, ceil(extract(epoch from (attempt.locked_until - now())) / 60)::int)
      using errcode = 'P0001';
  end if;

  select exists (
    select 1 from public.admin_pins
    where id = true and pin_hash = extensions.crypt(coalesce(input_pin, ''), pin_hash)
  ) into ok;

  if ok then
    delete from public.admin_pin_attempts where client_ip = ip;
    return true;
  end if;

  insert into public.admin_pin_attempts as a (client_ip, failures, first_failed_at)
  values (ip, 1, now())
  on conflict (client_ip) do update set
    failures = case when a.first_failed_at < now() - interval '15 minutes' then 1 else a.failures + 1 end,
    first_failed_at = case when a.first_failed_at < now() - interval '15 minutes' then now() else a.first_failed_at end,
    locked_until = case
      when a.first_failed_at >= now() - interval '15 minutes' and a.failures + 1 >= 5 then now() + interval '15 minutes'
      else null
    end;
  return false;
end;
$$;

revoke all on function public.request_client_ip() from public;
revoke all on function public.verify_admin_pin(text) from public;
grant execute on function public.verify_admin_pin(text) to anon, authenticated;
