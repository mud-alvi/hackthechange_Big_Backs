import { deliverPush, fetchWithTimeout, rest, type ServerSettings } from '../_shared/push.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function reply(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
export function createHandler(settings: ServerSettings, fetcher = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer \S+$/.test(authorization)) return reply(401, { error: 'Please sign in.' });
    if (!settings.supabaseUrl || !settings.publicKey || !settings.serviceKey) return reply(503, { error: 'Server configuration is incomplete.' });
    try {
      const auth = await fetchWithTimeout(settings.supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
        headers: { apikey: settings.publicKey, Authorization: authorization },
      }, fetcher);
      if (!auth.ok || typeof (await auth.json()).id !== 'string') return reply(401, { error: 'Please sign in again.' });
      const text = await request.text();
      if (text.length > 10000) return reply(400, { error: 'Request is too large.' });
      let body;
      try { body = JSON.parse(text); } catch { return reply(400, { error: 'Invalid JSON.' }); }
      let rpc: string, args: Record<string, unknown>;
      if (body.action === 'create') {
        rpc = 'village_create_request';
        args = { p_code: body.user_code, p_source: body.source, p_mode: body.mode,
          p_interest: body.interest_score ?? null, p_skill: body.skill_score ?? null };
      } else if (body.action === 'respond') {
        rpc = 'village_answer_request'; args = { p_request: body.request_id, p_accept: body.accept };
      } else if (body.action === 'message') {
        rpc = 'village_send_message'; args = { p_request: body.request_id, p_client: body.client_id, p_body: body.text };
      } else return reply(400, { error: 'Unknown action.' });
      // The user JWT, rather than the service role, enforces participation and mutual acceptance.
      const result = await rest(settings, 'rpc/' + rpc, 'POST', args, authorization.slice(7), fetcher);
      const requestId = body.action === 'message' ? result.request_id : result.id;
      let push_warning: string | undefined;
      try { await deliverPush(settings, requestId, fetcher); }
      catch { push_warning = 'Your action is saved. Notification delivery will retry.'; }
      return reply(200, { result, ...(push_warning ? { push_warning } : {}) });
    } catch (error) {
      return reply(400, { error: error instanceof Error ? error.message : 'Could not complete this action.' });
    }
  };
}
