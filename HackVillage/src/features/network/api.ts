import { supabase } from '../../../lib/supabase';
import type { AvatarLook } from '../../types/village';
import { readInterests, readUserCode } from '../interests/interest_data';
import type { DiscoverySettings, Interest } from '../interests/types';
import type { SkillMode, Skills } from '../skills/matcher';

export type Preferences = DiscoverySettings & { skill_mode: SkillMode };
export const DEFAULT_PREFERENCES: Preferences = { self_search: false, mode: 'both', minimum_score: 60, skill_mode: 'exchange' };
export type MatchingProfile = {
  id: string; user_code: string; username: string; total_xp: number; look: AvatarLook;
  interests: Interest[]; skills_have: string[]; skills_want: string[]; skills_need: string[];
  share_for_matching: boolean; preferences: Preferences;
};
export type Peer = Pick<MatchingProfile, 'id' | 'user_code' | 'username' | 'look' | 'interests' | 'skills_have' | 'skills_want' | 'skills_need'>;
export type ConnectionRequest = {
  id: string; user_a: string; user_b: string; a_accepted: boolean | null; b_accepted: boolean | null;
  status: 'pending' | 'accepted' | 'rejected'; source: 'bluetooth' | 'infrared'; mode: string;
  interest_score: number | null; skill_score: number | null; created_at: string; updated_at: string; expires_at: string;
  peer_id: string; peer_name: string; peer_code: string; peer_look: AvatarLook;
};
export type ServerMessage = { id: string; request_id: string; sender_id: string; client_id: string; body: string; created_at: string };
export class UnknownPeerError extends Error {}
export async function accountSession(expectedOwner?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session || (expectedOwner && data.session.user.id !== expectedOwner)) throw new Error('Your account changed. Please retry from the current account.');
  return data.session;
}
async function accountRPC(name: string, args: Record<string, unknown>, expectedOwner: string) {
  const session = await accountSession(expectedOwner);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '') + '/rest/v1/rpc/' + name, {
      method: 'POST', headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Your changes could not sync.');
    return result;
  } finally { clearTimeout(timer); }
}
function checkedProfile(row: MatchingProfile): MatchingProfile {
  return { ...row, user_code: readUserCode(row.user_code), interests: readInterests(row.interests),
    preferences: { ...DEFAULT_PREFERENCES, ...row.preferences } };
}
export async function loadMyProfile(): Promise<MatchingProfile> {
  const { data, error } = await supabase.rpc('village_ensure_profile');
  if (error) throw new Error('Your account could not sync. Reconnecting will retry.');
  return checkedProfile(data);
}
export async function findPeer(code: string): Promise<Peer> {
  const { data, error } = await supabase.rpc('village_lookup', { code: readUserCode(code) });
  if (error) throw error;
  if (!data) throw new UnknownPeerError('This person has not set up their village profile yet.');
  return { ...data, user_code: readUserCode(data.user_code), interests: readInterests(data.interests) };
}
export async function saveProfile(profile: MatchingProfile): Promise<MatchingProfile> {
  const data = await accountRPC('village_save_profile', { p_interests: profile.interests,
    p_have: profile.skills_have, p_want: profile.skills_want, p_need: profile.skills_need,
    p_share: profile.share_for_matching, p_preferences: profile.preferences, p_look: profile.look }, profile.id);
  return checkedProfile(data);
}
export function skillsOf(profile: Pick<Peer, 'skills_have' | 'skills_want' | 'skills_need'>): Skills {
  return { have: profile.skills_have, want: profile.skills_want, need: profile.skills_need };
}
export async function loadNetwork(): Promise<ConnectionRequest[]> {
  const { data, error } = await supabase.rpc('village_network_state');
  if (error) throw error;
  return data;
}
export async function networkAction(action: string, args: Record<string, unknown>, expectedOwner: string) {
  const session = await accountSession(expectedOwner);
  const { data, error } = await supabase.functions.invoke('networking', {
    body: { action, ...args }, headers: { Authorization: `Bearer ${session.access_token}` } });
  if (error) throw new Error('Could not sync this action. Check your connection and try again.');
  if (!data || typeof data !== 'object') throw new Error('The server returned an incomplete response. Please try again.');
  if (data.error) throw new Error(data.error);
  return data as { result: unknown; push_warning?: string };
}
export async function loadMessages(requestId: string, before?: { createdAt: string; id: string }): Promise<ServerMessage[]> {
  let query = supabase.from('village_messages').select('*').eq('request_id', requestId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
  if (before) {
    // Values originate from authenticated database rows; validate before building the PostgREST filter.
    if (!/^[0-9a-f-]{36}$/i.test(before.id) || !Number.isFinite(Date.parse(before.createdAt))) throw new Error('Invalid message cursor.');
    query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as ServerMessage[];
}
