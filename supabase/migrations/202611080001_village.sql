-- Additive integration. Existing public.profiles and public.connections are preserved.
-- Run in the SAME project as Supabase Auth. All public discovery codes remain TEXT.
begin;
create schema if not exists village_private;
revoke all on schema village_private from public;

create table if not exists public.village_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_code text not null unique check (user_code ~ '^[0-9]{6}$'),
  username text not null check (length(username) between 1 and 100),
  total_xp integer not null default 0 check(total_xp >= 0),
  look jsonb not null default '{"face":"smirk","shirt":"none","headwear":"none"}',
  created_at timestamptz not null default now()
);
create table if not exists public.village_matching (
  owner_id uuid primary key references public.village_profiles(id) on delete cascade,
  interests jsonb not null default '[]' check(jsonb_typeof(interests)='array' and jsonb_array_length(interests)<=100),
  skills_have text[] not null default '{}', skills_want text[] not null default '{}', skills_need text[] not null default '{}',
  share_for_matching boolean not null default false,
  preferences jsonb not null default '{"self_search":false,"mode":"both","minimum_score":60,"skill_mode":"exchange"}'
);
create table if not exists public.village_requests (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.village_profiles(id) on delete cascade,
  user_b uuid not null references public.village_profiles(id) on delete cascade,
  a_accepted boolean, b_accepted boolean,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  source text not null check(source in ('bluetooth','infrared')),
  mode text not null check(mode in ('interests','skills','both')),
  interest_score numeric check(interest_score between 0 and 100), skill_score numeric check(skill_score between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '24 hours',
  unique(user_a,user_b), check(user_a<user_b),
  check(status<>'accepted' or (a_accepted is true and b_accepted is true))
);
create table if not exists public.village_messages (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.village_requests(id) on delete cascade,
  sender_id uuid not null references public.village_profiles(id) on delete cascade,
  client_id uuid not null, body text not null check(length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(), unique(sender_id,client_id)
);
create index if not exists village_message_history on public.village_messages(request_id,created_at desc,id desc);
create table if not exists public.village_devices (
  token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check(platform in ('android','ios')), updated_at timestamptz not null default now()
);
create table if not exists public.village_notification_jobs (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.village_requests(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text not null, data jsonb not null,
  attempts integer not null default 0, available_at timestamptz not null default now(),
  locked_until timestamptz, delivered_at timestamptz, last_error text, created_at timestamptz not null default now()
);

create or replace function village_private.legacy_profile(uid uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if to_regclass('public.profiles') is not null then
    execute 'select to_jsonb(p) from public.profiles p where coalesce(to_jsonb(p)->>''id'',to_jsonb(p)->>''user_id'')=$1 limit 1'
    into result using uid::text;
  end if;
  return result;
end $$;
create or replace function village_private.legacy_code_exists(code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare found boolean:=false;
begin
  if to_regclass('public.profiles') is not null then
    execute 'select exists(select 1 from public.profiles p where coalesce(to_jsonb(p)->>''user_code'',to_jsonb(p)->>''usercode'',to_jsonb(p)->>''userCode'')=$1)'
    into found using code;
  end if;
  return found;
end $$;

create or replace function public.village_ensure_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); legacy jsonb; code text; display_name text; row public.village_profiles; tries integer:=0;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into row from public.village_profiles where id=uid;
  if row.id is null then
    legacy:=village_private.legacy_profile(uid);
    code:=coalesce(legacy->>'user_code',legacy->>'usercode',legacy->>'userCode');
    display_name:=coalesce(nullif(legacy->>'username',''),(select raw_user_meta_data->>'username' from auth.users where id=uid),'Villager');
    if code is not null and code !~ '^[0-9]{6}$' then
      raise exception 'Existing profile code is not six digits. Review it before provisioning.';
    end if;
    if code is not null then
      insert into public.village_profiles(id,user_code,username,total_xp)
      values(uid,code,left(display_name,100),case when legacy->>'total_xp' ~ '^[0-9]{1,8}$' then (legacy->>'total_xp')::integer else 0 end)
      returning * into row;
    else
      loop
        tries:=tries+1;
        if tries>200 then raise exception 'Could not allocate a user code'; end if;
        code:=lpad(floor(random()*1000000)::integer::text,6,'0');
        if village_private.legacy_code_exists(code) then continue; end if;
        begin
          insert into public.village_profiles(id,user_code,username) values(uid,code,left(display_name,100)) returning * into row;
          exit;
        exception when unique_violation then null;
        end;
      end loop;
    end if;
  end if;
  insert into public.village_matching(owner_id) values(uid) on conflict do nothing;
  return to_jsonb(row)||(select to_jsonb(m)-'owner_id' from public.village_matching m where owner_id=uid);
end $$;

create or replace function village_private.validate_interests(tags jsonb) returns void
language plpgsql set search_path='' as $$
declare tag jsonb;
begin
  if tags is null or jsonb_typeof(tags)<>'array' or jsonb_array_length(tags)>100 then raise exception 'Invalid interests'; end if;
  for tag in select * from jsonb_array_elements(tags) loop
    if jsonb_typeof(tag)<>'object' or not (tag ?& array['label','standard_id','category','subcategory'])
      or jsonb_typeof(tag->'label')<>'string' or length(btrim(tag->>'label')) not between 1 and 100
      or jsonb_typeof(tag->'standard_id')<>'string' or length(tag->>'standard_id') not between 1 and 200
      or jsonb_typeof(tag->'category')<>'string' or length(tag->>'category')>200
      or jsonb_typeof(tag->'subcategory')<>'string' or length(tag->>'subcategory')>200
      or (tag->>'subcategory'<>'' and tag->>'category'='') then raise exception 'Invalid interest tags'; end if;
  end loop;
end $$;
create or replace function public.village_save_profile(p_interests jsonb,p_have text[],p_want text[],p_need text[],p_share boolean,p_preferences jsonb,p_look jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare skill text;
begin
  perform public.village_ensure_profile();
  perform village_private.validate_interests(p_interests);
  if p_have is null or p_want is null or p_need is null or cardinality(p_have)>100 or cardinality(p_want)>100 or cardinality(p_need)>100 then raise exception 'Invalid skills'; end if;
  foreach skill in array p_have||p_want||p_need loop
    if skill is null or length(btrim(skill)) not between 1 and 100 then raise exception 'Invalid skill'; end if;
  end loop;
  if p_share is null or p_preferences is null or jsonb_typeof(p_preferences->'self_search') is distinct from 'boolean'
    or coalesce(p_preferences->>'mode','') not in ('interests','skills','both')
    or coalesce(p_preferences->>'skill_mode','') not in ('exchange','collaboration','learning')
    or jsonb_typeof(p_preferences->'minimum_score') is distinct from 'number'
    or (p_preferences->>'minimum_score')::numeric not between 0 and 100 then raise exception 'Invalid preferences'; end if;
  if p_look is null or coalesce(p_look->>'face','') not in ('smirk','happy','sleepy','blank')
    or coalesce(p_look->>'shirt','') not in ('none','violet','mint','pink','ink')
    or coalesce(p_look->>'headwear','') not in ('none','cap','beanie','hair') then raise exception 'Invalid avatar'; end if;
  update public.village_matching set interests=p_interests,skills_have=p_have,skills_want=p_want,skills_need=p_need,
    share_for_matching=p_share,preferences=p_preferences where owner_id=auth.uid();
  update public.village_profiles set look=p_look where id=auth.uid();
  return public.village_ensure_profile();
end $$;

create or replace function public.village_lookup(code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if code is null or code !~ '^[0-9]{6}$' then raise exception 'Expected six-digit code'; end if;
  select jsonb_build_object('id',p.id,'user_code',p.user_code,'username',p.username,'look',p.look,
    'interests',case when m.share_for_matching then m.interests else '[]'::jsonb end,
    'skills_have',case when m.share_for_matching then to_jsonb(m.skills_have) else '[]'::jsonb end,
    'skills_want',case when m.share_for_matching then to_jsonb(m.skills_want) else '[]'::jsonb end,
    'skills_need',case when m.share_for_matching then to_jsonb(m.skills_need) else '[]'::jsonb end)
  into result from public.village_profiles p join public.village_matching m on m.owner_id=p.id where p.user_code=code;
  return result;
end $$;

create or replace function public.village_save_interests(p_interests jsonb,p_share boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.village_ensure_profile();
  perform village_private.validate_interests(p_interests);
  if p_share is null then raise exception 'Choose whether to share interests'; end if;
  update public.village_matching set interests=p_interests,share_for_matching=p_share where owner_id=auth.uid();
end $$;

create or replace function village_private.enqueue(request uuid,recipient uuid,title text,body text,payload jsonb) returns void
language sql set search_path='' as $$
  insert into public.village_notification_jobs(request_id,recipient_id,title,body,data) values(request,recipient,title,body,payload);
$$;
create or replace function public.village_create_request(p_code text,p_source text,p_mode text,p_interest numeric,p_skill numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); peer uuid; a uuid; b uuid; row public.village_requests;
begin
  perform public.village_ensure_profile();
  if p_code is null or p_code !~ '^[0-9]{6}$' or p_source is null or p_source not in ('bluetooth','infrared')
    or p_mode is null or p_mode not in ('interests','skills','both') or p_interest not between 0 and 100 or p_skill not between 0 and 100
    or p_interest::text in ('NaN','Infinity','-Infinity') or p_skill::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid request'; end if;
  select id into peer from public.village_profiles where user_code=p_code;
  if peer is null or peer=uid then raise exception 'Unknown or own user code'; end if;
  a:=least(uid,peer); b:=greatest(uid,peer);
  perform pg_advisory_xact_lock(hashtextextended(a::text||b::text,0));
  select * into row from public.village_requests where user_a=a and user_b=b for update;
  if row.id is not null and (row.status='accepted' or (row.status='pending' and row.expires_at>now()) or row.updated_at>now()-interval '5 minutes') then return to_jsonb(row); end if;
  if (select count(*) from public.village_requests where (user_a=uid or user_b=uid) and updated_at>now()-interval '1 minute')>=20 then raise exception 'Too many requests; wait a minute'; end if;
  insert into public.village_requests(user_a,user_b,source,mode,interest_score,skill_score)
    values(a,b,p_source,p_mode,p_interest,p_skill)
    on conflict(user_a,user_b) do update set status='pending',a_accepted=null,b_accepted=null,source=excluded.source,
      mode=excluded.mode,interest_score=excluded.interest_score,skill_score=excluded.skill_score,updated_at=now(),expires_at=now()+interval '24 hours'
    returning * into row;
  perform village_private.enqueue(row.id,a,'A new village connection','Open HackVillage to accept or decline.',jsonb_build_object('request_id',row.id,'type','request'));
  perform village_private.enqueue(row.id,b,'A new village connection','Open HackVillage to accept or decline.',jsonb_build_object('request_id',row.id,'type','request'));
  return to_jsonb(row);
end $$;

create or replace function public.village_answer_request(p_request uuid,p_accept boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row public.village_requests; previous text;
begin
  select * into row from public.village_requests where id=p_request and uid in (user_a,user_b) for update;
  if uid is null or row.id is null then raise exception 'Request unavailable'; end if;
  if p_accept is null then raise exception 'Choose accept or decline'; end if;
  if row.status<>'pending' then return to_jsonb(row); end if;
  if row.expires_at<=now() then raise exception 'Request expired'; end if;
  if (uid=row.user_a and row.a_accepted is not null and row.a_accepted<>p_accept)
    or (uid=row.user_b and row.b_accepted is not null and row.b_accepted<>p_accept) then raise exception 'You already answered'; end if;
  previous:=row.status;
  if uid=row.user_a then row.a_accepted:=p_accept; else row.b_accepted:=p_accept; end if;
  row.status:=case when row.a_accepted is false or row.b_accepted is false then 'rejected'
    when row.a_accepted is true and row.b_accepted is true then 'accepted' else 'pending' end;
  update public.village_requests set a_accepted=row.a_accepted,b_accepted=row.b_accepted,status=row.status,updated_at=now() where id=row.id;
  if previous<>row.status and row.status='accepted' then
    perform village_private.enqueue(row.id,row.user_a,'You are connected!','You both accepted. Say hello in chat.',jsonb_build_object('request_id',row.id,'type','connected'));
    perform village_private.enqueue(row.id,row.user_b,'You are connected!','You both accepted. Say hello in chat.',jsonb_build_object('request_id',row.id,'type','connected'));
  end if;
  return to_jsonb(row);
end $$;

create or replace function public.village_send_message(p_request uuid,p_client uuid,p_body text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row public.village_requests; message public.village_messages; peer uuid;
begin
  select * into row from public.village_requests where id=p_request and status='accepted' and uid in (user_a,user_b) for share;
  if uid is null or row.id is null then raise exception 'Both users must accept before chatting'; end if;
  if p_client is null or p_body is null or length(btrim(p_body)) not between 1 and 1000 then raise exception 'Invalid message'; end if;
  select * into message from public.village_messages where sender_id=uid and client_id=p_client;
  if message.id is not null then
    if message.request_id<>p_request or message.body<>btrim(p_body) then raise exception 'Message ID was already used'; end if;
    return to_jsonb(message);
  end if;
  insert into public.village_messages(request_id,sender_id,client_id,body) values(p_request,uid,p_client,btrim(p_body))
    on conflict(sender_id,client_id) do nothing returning * into message;
  if message.id is null then
    select * into message from public.village_messages where sender_id=uid and client_id=p_client;
    if message.request_id<>p_request or message.body<>btrim(p_body) then raise exception 'Message ID was already used'; end if;
    return to_jsonb(message);
  end if;
  peer:=case when uid=row.user_a then row.user_b else row.user_a end;
  perform village_private.enqueue(row.id,peer,'A new village message','Open HackVillage to read your message.',jsonb_build_object('request_id',row.id,'type','message'));
  return to_jsonb(message);
end $$;

create or replace function public.village_network_state() returns jsonb
language sql security definer set search_path='' as $$
select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('peer_id',p.id,'peer_name',p.username,'peer_code',p.user_code,'peer_look',p.look) order by r.updated_at desc),'[]'::jsonb)
from public.village_requests r join public.village_profiles p on p.id=case when r.user_a=auth.uid() then r.user_b else r.user_a end
where auth.uid() in (r.user_a,r.user_b) and (r.status='accepted' or (r.status='pending' and r.expires_at>now()));
$$;
create or replace function public.village_register_device(p_token text,p_platform text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if (select count(*) from public.village_devices where owner_id=auth.uid() and token<>p_token)>=10 then raise exception 'Too many registered phones'; end if;
  insert into public.village_devices(token,owner_id,platform) values(p_token,auth.uid(),p_platform)
    on conflict(token) do update set owner_id=auth.uid(),platform=p_platform,updated_at=now();
end $$;
create or replace function public.village_unregister_device(p_token text) returns void
language sql security definer set search_path='' as $$
delete from public.village_devices where token=p_token and owner_id=auth.uid();
$$;

-- Worker is service-role-only. Leases permit retries after crashes and prevent concurrent dispatch.
create or replace function public.village_claim_notifications(p_request uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  with jobs as (select id from public.village_notification_jobs where delivered_at is null and available_at<=now()
    and (locked_until is null or locked_until<now()) and attempts<6 and (p_request is null or request_id=p_request)
    order by created_at for update skip locked limit 20),
  leased as (update public.village_notification_jobs j set attempts=attempts+1,locked_until=now()+interval '2 minutes'
    where id in (select id from jobs) returning j.*)
  select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('tokens',(select coalesce(jsonb_agg(token),'[]') from public.village_devices d where d.owner_id=l.recipient_id))),'[]') into result from leased l;
  return result;
end $$;

alter table public.village_profiles enable row level security;
alter table public.village_matching enable row level security;
alter table public.village_requests enable row level security;
alter table public.village_messages enable row level security;
alter table public.village_devices enable row level security;
alter table public.village_notification_jobs enable row level security;
create policy village_profile_owner on public.village_profiles for select to authenticated using(id=auth.uid());
create policy village_matching_owner on public.village_matching for select to authenticated using(owner_id=auth.uid());
create policy village_request_participant on public.village_requests for select to authenticated using(auth.uid() in (user_a,user_b));
create policy village_message_participant on public.village_messages for select to authenticated using(exists(
  select 1 from public.village_requests r where r.id=request_id and r.status='accepted' and auth.uid() in (r.user_a,r.user_b)));
revoke all on public.village_profiles,public.village_matching,public.village_requests,public.village_messages from anon,authenticated;
grant select on public.village_profiles,public.village_matching,public.village_requests,public.village_messages to authenticated;
revoke all on public.village_devices,public.village_notification_jobs from anon,authenticated;
grant all on public.village_profiles,public.village_matching,public.village_requests,public.village_messages,public.village_devices,public.village_notification_jobs to service_role;
revoke all on all functions in schema village_private from public,anon,authenticated;
revoke all on function public.village_claim_notifications(uuid) from public,anon,authenticated;
grant execute on function public.village_claim_notifications(uuid) to service_role;
do $$ declare signature text; begin
  foreach signature in array array['village_ensure_profile()','village_save_profile(jsonb,text[],text[],text[],boolean,jsonb,jsonb)',
    'village_lookup(text)','village_save_interests(jsonb,boolean)','village_create_request(text,text,text,numeric,numeric)','village_answer_request(uuid,boolean)',
    'village_send_message(uuid,uuid,text)','village_network_state()','village_register_device(text,text)','village_unregister_device(text)'] loop
    execute 'revoke all on function public.'||signature||' from public,anon';
    execute 'grant execute on function public.'||signature||' to authenticated';
  end loop;
end $$;
do $$ declare name text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach name in array array['village_requests','village_messages'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=name) then
        execute format('alter publication supabase_realtime add table public.%I',name);
      end if;
    end loop;
  end if;
end $$;
commit;
