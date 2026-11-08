import { deliverPush } from '../_shared/push.ts';
const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
  if (!secret || request.headers.get('x-dispatch-secret') !== secret) return new Response('Unauthorized', { status: 401 });
  try {
    const delivered = await deliverPush({ supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      publicKey: Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '',
      serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', expoAccessToken: Deno.env.get('EXPO_ACCESS_TOKEN') }, null);
    return Response.json({ delivered });
  } catch { return Response.json({ error: 'Dispatch failed' }, { status: 500 }); }
});
