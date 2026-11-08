import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Client, type QueryResultRow } from 'pg';

test('Postgres enforces account identity, private profiles, mutual acceptance, message idempotency, and outbox isolation', async () => {
  if (!process.env.VILLAGE_TEST_DATABASE_URL) throw new Error('Set VILLAGE_TEST_DATABASE_URL to an EMPTY, disposable local PostgreSQL database.');
  const url = new URL(process.env.VILLAGE_TEST_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Database tests only run against a disposable LOCAL server.');
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const databaseName = 'village_test_' + randomUUID().replaceAll('-', '');
  await admin.query('create database ' + databaseName);
  await admin.end();
  url.pathname = '/' + databaseName;
  const connection = new Client({ connectionString: url.toString() });
  await connection.connect();
  const db = { exec: (sql: string) => connection.query(sql),
    query: <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => connection.query<T>(sql, values),
    close: () => connection.end() };
  try {
    await db.exec(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
      end $$;
      create schema auth; grant usage on schema auth,public to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.profiles(id uuid primary key,username text,usercode text,total_xp integer default 0);
      create table public.connections(id integer primary key);
      insert into public.connections values(99);
      insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
      insert into public.profiles(id,username,usercode) values('00000000-0000-4000-8000-000000000001','A','001234'),('00000000-0000-4000-8000-000000000002','B','065280');`);
    await db.exec(readFileSync('../supabase/migrations/202611080001_village.sql', 'utf8'));
    const owners = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
    const asUser = async (index: number) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owners[index]]);
      await db.exec('set role authenticated');
    };
    const call = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<{ result: T }>(sql, params)).rows[0].result;
    await asUser(0);
    assert.equal((await call('select public.village_ensure_profile() as result')).user_code, '001234');
    assert.equal((await call('select public.village_ensure_profile() as result')).user_code, '001234');
    await asUser(1);
    assert.equal((await call('select public.village_ensure_profile() as result')).user_code, '065280');
    await asUser(2); await call('select public.village_ensure_profile() as result');
    await asUser(0);
    const visible = await db.query('select id from public.village_profiles'); assert.equal(visible.rows.length, 1);
    await assert.rejects(db.exec(`update public.village_profiles set user_code='999999'`));
    await assert.rejects(db.exec('select * from public.village_notification_jobs'));
    const request = await call<{ id: string; status: string }>("select public.village_create_request('065280','infrared','both',72.5,85) as result");
    const repeated = await call<{ id: string }>("select public.village_create_request('065280','infrared','both',72.5,85) as result");
    assert.equal(request.id, repeated.id);
    const clientId = '00000000-0000-4000-8000-000000000099';
    await assert.rejects(db.query("select public.village_send_message($1,$2,'hello')", [request.id, clientId]));
    assert.equal((await call('select public.village_answer_request($1,true) as result', [request.id])).status, 'pending');
    await assert.rejects(db.query("select public.village_send_message($1,$2,'hello')", [request.id, clientId]));
    await asUser(2);
    await assert.rejects(db.query('select public.village_answer_request($1,true)', [request.id]));
    assert.equal((await db.query('select * from public.village_messages')).rows.length, 0);
    await asUser(1);
    assert.equal((await call('select public.village_answer_request($1,true) as result', [request.id])).status, 'accepted');
    await asUser(0);
    const first = await call("select public.village_send_message($1,$2,'hello') as result", [request.id, clientId]);
    const again = await call("select public.village_send_message($1,$2,'hello') as result", [request.id, clientId]);
    assert.equal(first.id, again.id);
    await assert.rejects(db.query("select public.village_send_message($1,$2,'changed')", [request.id, clientId]));
    await assert.rejects(db.query('select public.village_claim_notifications(null)'));
    await asUser(1);
    assert.equal((await db.query('select * from public.village_messages')).rows.length, 1);
    const peer = await call("select public.village_lookup('001234') as result");
    assert.deepEqual(peer.interests, []);
    assert.equal(Object.hasOwn(peer, 'email'), false);
    await db.exec('reset role');
    assert.equal((await db.query('select * from public.connections')).rows.length, 1);
    assert.equal((await db.query('select * from public.profiles')).rows.length, 2);
    assert.equal((await db.query('select * from public.village_notification_jobs')).rows.length, 5);
    await db.exec('set role service_role');
    const jobs = await call<unknown[]>('select public.village_claim_notifications(null) as result');
    assert.equal(jobs.length, 5);
    assert.equal((await call<unknown[]>('select public.village_claim_notifications(null) as result')).length, 0);
  } finally { await db.close(); }
});
