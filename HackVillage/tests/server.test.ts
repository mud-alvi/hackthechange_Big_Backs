import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../../supabase/functions/networking/handler';
import { deliverPush } from '../../supabase/functions/_shared/push';

const settings = { supabaseUrl: 'https://project.example', publicKey: 'public', serviceKey: 'service' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test('networking verifies the user session before any database action', async () => {
  let calls = 0;
  const handler = createHandler(settings, async () => { calls++; return json({}, 401); });
  assert.equal((await handler(new Request('https://function.example', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal(calls, 0);
  assert.equal((await handler(new Request('https://function.example', { method: 'POST', headers: { Authorization: 'Bearer bad' }, body: '{}' }))).status, 401);
  assert.equal(calls, 1);
});
test('request creation forwards the user JWT and keeps service credentials on the server', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const handler = createHandler(settings, async (input, init) => {
    const url = String(input); calls.push({ url, init: init! });
    if (url.endsWith('/auth/v1/user')) return json({ id: 'authenticated-user' });
    if (url.endsWith('/rpc/village_create_request')) return json({ id: 'request-id' });
    if (url.endsWith('/rpc/village_claim_notifications')) return json([]);
    throw new Error('Unexpected outbound request');
  });
  const response = await handler(new Request('https://function.example', { method: 'POST', headers: { Authorization: 'Bearer user-session' },
    body: JSON.stringify({ action: 'create', user_code: '001234', source: 'infrared', mode: 'both', interest_score: 72.5, skill_score: null, actor: 'spoofed-user' }) }));
  assert.equal(response.status, 200);
  const rpc = calls.find(call => call.url.endsWith('/rpc/village_create_request'))!;
  assert.equal((rpc.init.headers as Record<string, string>).Authorization, 'Bearer user-session');
  assert.equal(JSON.parse(String(rpc.init.body)).actor, undefined);
  assert.equal(JSON.parse(String(rpc.init.body)).p_code, '001234');
  assert.equal(JSON.stringify(await response.json()).includes('service'), false);
});
test('failed push delivery returns the job to the retry queue', async () => {
  const patches: Record<string, unknown>[] = [];
  const count = await deliverPush(settings, 'request-id', async (input, init) => {
    const url = String(input);
    if (url.endsWith('/rpc/village_claim_notifications')) return json([{ id: 'job-id', request_id: 'request-id', title: 'Request', body: 'Open app', data: {}, tokens: ['ExpoPushToken[test]'], attempts: 1 }]);
    if (url.includes('exp.host')) return json({}, 503);
    if (init?.method === 'PATCH') { patches.push(JSON.parse(String(init.body))); return json([]); }
    throw new Error('Unexpected call');
  });
  assert.equal(count, 0); assert.equal(patches[0].locked_until, null);
  assert.equal(typeof patches[0].available_at, 'string'); assert.equal(patches[0].delivered_at, undefined);
});
test('invalid device tokens are removed and valid notification tickets finish the job', async () => {
  const deletions: string[] = [], patches: Record<string, unknown>[] = [];
  const count = await deliverPush(settings, 'request-id', async (input, init) => {
    const url = String(input);
    if (url.endsWith('/rpc/village_claim_notifications')) return json([{ id: 'job-id', request_id: 'request-id', title: 'Request', body: 'Open app', data: {}, tokens: ['ExpoPushToken[old]', 'ExpoPushToken[new]'], attempts: 1 }]);
    if (url.includes('exp.host')) return json({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, { status: 'ok', id: 'ticket' }] });
    if (init?.method === 'DELETE') { deletions.push(url); return json([]); }
    if (init?.method === 'PATCH') { patches.push(JSON.parse(String(init.body))); return json([]); }
    throw new Error('Unexpected call');
  });
  assert.equal(count, 1); assert.equal(deletions.length, 1); assert.equal(typeof patches[0].delivered_at, 'string');
});
