-- Play-off matches live in data.playoff.matches (apart from the league matches),
-- so update_league_match also looks there when the id is not a league match.
-- League matches behave exactly as in 003.
create or replace function public.update_league_match(input_pin text, input_match jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_data jsonb;
  match_index integer;
  match_path text[];
begin
  if not public.verify_admin_pin(input_pin) then
    return null;
  end if;

  select data into current_data from public.league_state where id = 1 for update;
  if current_data is null then
    raise exception 'Data liga tidak dijumpai.';
  end if;

  select (ordinality - 1)::integer into match_index
  from jsonb_array_elements(current_data -> 'matches') with ordinality
  where value ->> 'id' = input_match ->> 'id';
  match_path := array['matches', match_index::text];

  if match_index is null and jsonb_typeof(current_data -> 'playoff' -> 'matches') = 'array' then
    select (ordinality - 1)::integer into match_index
    from jsonb_array_elements(current_data -> 'playoff' -> 'matches') with ordinality
    where value ->> 'id' = input_match ->> 'id';
    match_path := array['playoff', 'matches', match_index::text];
  end if;

  if match_index is null then
    raise exception 'Perlawanan % tidak dijumpai.', input_match ->> 'id';
  end if;

  update public.league_state
  set data = jsonb_set(current_data, match_path, input_match)
             || jsonb_build_object('updatedAt', to_jsonb(now())),
      updated_at = now()
  where id = 1
  returning data into current_data;

  return current_data;
end;
$$;

revoke all on function public.update_league_match(text, jsonb) from public;
grant execute on function public.update_league_match(text, jsonb) to anon, authenticated;
