type Job = { id: string; request_id: string; title: string; body: string; data: Record<string, unknown>; tokens: string[]; attempts: number };
export type ServerSettings = { supabaseUrl: string; publicKey: string; serviceKey: string; expoAccessToken?: string; dispatchSecret?: string };
export async function fetchWithTimeout(url: string, init: RequestInit, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try { return await fetcher(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
export async function rest(settings: ServerSettings, path: string, method: string, body: unknown, token: string, fetcher = fetch) {
  const response = await fetchWithTimeout(settings.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + path, {
    method, headers: { apikey: token === settings.serviceKey ? settings.serviceKey : settings.publicKey,
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, fetcher);
  const value = await response.text();
  const parsed = value ? JSON.parse(value) : null;
  if (!response.ok) throw new Error(parsed?.message || 'Database request failed.');
  return parsed;
}
export async function deliverPush(settings: ServerSettings, requestId: string | null, fetcher = fetch): Promise<number> {
  const jobs: Job[] = await rest(settings, 'rpc/village_claim_notifications', 'POST', { p_request: requestId }, settings.serviceKey, fetcher);
  let delivered = 0;
  for (const job of jobs) {
    try {
      // Devices are capped by the registration RPC. Chunking also respects Expo's 100-message API limit.
      for (let start = 0; start < job.tokens.length; start += 100) {
        const tokens = job.tokens.slice(start, start + 100);
        const response = await fetchWithTimeout('https://exp.host/--/api/v2/push/send', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(settings.expoAccessToken ? { Authorization: `Bearer ${settings.expoAccessToken}` } : {}) },
          body: JSON.stringify(tokens.map(to => ({ to, title: job.title, body: job.body,
            data: job.data, sound: 'default', channelId: 'village-requests', priority: 'high' }))),
        }, fetcher);
        if (!response.ok) throw new Error(`Push service returned ${response.status}`);
        const result = await response.json();
        if (!Array.isArray(result.data) || result.data.length !== tokens.length) throw new Error('Invalid push response');
        let retry = false;
        for (let index = 0; index < result.data.length; index++) {
          const ticket = result.data[index];
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            await rest(settings, 'village_devices?token=eq.' + encodeURIComponent(tokens[index]), 'DELETE', undefined, settings.serviceKey, fetcher);
          } else if (ticket.status !== 'ok') retry = true;
        }
        if (retry) throw new Error('One or more push deliveries need retrying');
      }
      await rest(settings, 'village_notification_jobs?id=eq.' + job.id, 'PATCH', {
        delivered_at: new Date().toISOString(), locked_until: null, last_error: null,
      }, settings.serviceKey, fetcher);
      delivered++;
    } catch (error) {
      await rest(settings, 'village_notification_jobs?id=eq.' + job.id, 'PATCH', {
        locked_until: null, available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000).toISOString(),
        last_error: error instanceof Error ? error.message : 'Push dispatch failed',
      }, settings.serviceKey, fetcher);
    }
  }
  return delivered;
}
