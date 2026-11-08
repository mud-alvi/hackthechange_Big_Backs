-- Run after the main migration and deployment of dispatch-push.
-- First create two secrets in Supabase Vault:
-- village_project_url = https://YOUR_PROJECT.supabase.co
-- village_push_dispatch_secret = the SAME random value as Edge secret PUSH_DISPATCH_SECRET.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists(select 1 from vault.decrypted_secrets where name='village_project_url')
    or not exists(select 1 from vault.decrypted_secrets where name='village_push_dispatch_secret') then
    raise exception 'Create the two Vault secrets documented in SETUP.md first';
  end if;
end $$;
select cron.schedule('village-push-retry', '* * * * *', $$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='village_project_url' limit 1)||'/functions/v1/dispatch-push',
    headers:=jsonb_build_object('Content-Type','application/json','x-dispatch-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='village_push_dispatch_secret' limit 1)),
    body:='{}'::jsonb
  );
$$);
