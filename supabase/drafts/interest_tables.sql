--DRAFT: review against the existing project before running this SQL.
--Requires public.profiles(id uuid, user_code text) with one UNIQUE user_code per account.
--This does not replace profiles, create login accounts, generate codes or touch skills.

begin;

create table public.user_interests (
    owner_id uuid primary key references public.profiles(id) on delete cascade,
    interests jsonb not null default '[]'::jsonb,
    share_for_matching boolean not null default false,
    constraint interests_is_array check (jsonb_typeof(interests) = 'array'),
    constraint interest_count check (jsonb_array_length(interests) <= 100)
);

alter table public.user_interests enable row level security;
revoke all on public.user_interests from anon, authenticated;
grant select, insert, update, delete on public.user_interests to authenticated;

create policy owner_reads_interests on public.user_interests for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy owner_adds_interests on public.user_interests for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy owner_changes_interests on public.user_interests for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy owner_deletes_interests on public.user_interests for delete to authenticated
    using ((select auth.uid()) = owner_id);

--Only return the public code and opted-in matching tags, never email or account data.
--Knowing a code is not proof of proximity. This permits signed-in code lookup.
create function public.lookup_interest_profile(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result jsonb;
begin
    if auth.uid() is null then raise exception 'Sign in first'; end if;
    if code is null or upper(trim(code)) !~ '^[A-Z]{3}[0-9]{4}$' then
        raise exception 'Invalid user code';
    end if;
    select jsonb_build_object('user_code', p.user_code,
        'interests', case when i.share_for_matching then i.interests else '[]'::jsonb end)
    into strict result
    from public.profiles p left join public.user_interests i on i.owner_id = p.id
    where p.user_code = upper(trim(code));
    return result;
exception when no_data_found then
    return null;
end;
$$;

revoke all on function public.lookup_interest_profile(text) from public, anon;
grant execute on function public.lookup_interest_profile(text) to authenticated;

commit;
