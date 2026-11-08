import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../../lib/supabase';
import { BoardClient } from '../features/device/client';
import type { BoardDevice } from '../features/device/types';
import { scoreCommand, type FoundEvent } from '../features/device/protocol';
import { createDiscoveryHandler } from '../features/interests/discovery';
import { createSupabaseStore } from '../features/interests/supabase_store';
import type { DiscoveryResult, Interest } from '../features/interests/types';
import { exactTextInterests } from '../features/interests/interest_data';
import { calculateSkillMatch } from '../features/skills/matcher';
import { DEFAULT_PREFERENCES, findPeer, loadMessages, loadMyProfile, loadNetwork, networkAction, saveProfile, skillsOf,
  UnknownPeerError, type ConnectionRequest, type MatchingProfile, type Preferences, type ServerMessage } from '../features/network/api';
import { listenForNotifications, registerNotifications, unregisterNotifications } from '../features/network/notifications';
import { BASE_LOOK, type AvatarLook, type VillageData } from '../types/village';

type Options = { session: Session | null; ready: boolean; setData: Dispatch<SetStateAction<VillageData>>;
  setProfile: (profile: { username: string; total_xp: number; user_code: string }) => void; setNotice: (text: string) => void };
export function useVillageNetwork({ session, ready, setData, setProfile, setNotice }: Options) {
  const [matchingProfile, setMatchingProfile] = useState<MatchingProfile | null>(null);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [devices, setDevices] = useState<BoardDevice[]>([]);
  const [boardStatus, setBoardStatus] = useState('Board disconnected.');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [lastMatch, setLastMatch] = useState<{ owner: string; value: DiscoveryResult } | null>(null);
  const [hasOlder, setHasOlder] = useState<Record<string, boolean>>({});
  const client = useRef<BoardClient | null>(null);
  const matching = useRef<MatchingProfile | null>(null);
  const handler = useRef<ReturnType<typeof createDiscoveryHandler> | null>(null);
  const peerLookup = useRef<((code: string) => ReturnType<typeof findPeer>) | null>(null);
  const user = useRef(session?.user.id);
  useLayoutEffect(() => { user.current = session?.user.id; }, [session?.user.id]);
  const configured = useRef(false);
  const token = useRef<string | null>(null);
  const epoch = useRef(0);
  const eventResults = useRef(new Map<string, DiscoveryResult | null>());
  const busyEvents = useRef(new Set<string>());
  const completedEvents = useRef(new Set<string>());
  const messageIds = useRef(new Map<string, string>());
  const dataRef = useRef<VillageData | null>(null);
  const activeProfile = matchingProfile?.id === session?.user.id ? matchingProfile : null;
  const preferences = activeProfile?.preferences ?? DEFAULT_PREFERENCES;

  const mergeMessages = useCallback((requestId: string, rows: ServerMessage[], owner: string) => {
    if (user.current !== owner) return;
    setData(current => { const next = { ...current, encounters: current.encounters.map(encounter => {
      if (encounter.id !== requestId) return encounter;
      const messages = new Map(encounter.messages.map(message => [message.id, message]));
      let added = 0;
      for (const row of rows) {
        if (!messages.has(row.id) && row.sender_id !== owner) added++;
        messages.set(row.id, { id: row.id, text: row.body, sender: row.sender_id === owner ? 'me' : 'them', createdAt: row.created_at });
      }
      return { ...encounter, unread: encounter.unread + added,
        messages: [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) };
    }) }; dataRef.current = next; return next; });
  }, [setData]);

  const refreshNetwork = useCallback(async () => {
    const owner = user.current;
    if (!owner) return;
    const rows = await loadNetwork();
    if (user.current !== owner) return;
    setRequests(rows.filter(row => row.status === 'pending'));
    setData(current => {
      const next = { ...current, encounters: rows.filter(row => row.status === 'accepted').map(row => {
        const previous = current.encounters.find(encounter => encounter.id === row.id);
        return { id: row.id, peerId: row.peer_id, name: row.peer_name, metAt: row.created_at,
          look: row.peer_look || BASE_LOOK, messages: previous?.messages ?? [], unread: previous?.unread ?? 0 };
      }) };
      dataRef.current = next;
      return next;
    });
  }, [setData]);

  const applyProfile = useCallback((profile: MatchingProfile) => {
    if (profile.id !== user.current) return;
    handler.current?.reset();
    matching.current = profile;
    setMatchingProfile(profile);
    setProfile({ username: profile.username, user_code: profile.user_code, total_xp: profile.total_xp });
    setData(current => ({ ...current, look: profile.look }));
    eventResults.current.clear();
    completedEvents.current.clear();
    const peerCache = new Map<string, { value: ReturnType<typeof findPeer>; expires: number }>();
    const peer = (code: string) => {
      let cached = peerCache.get(code);
      if (!cached || cached.expires < Date.now()) {
        const value = findPeer(code).catch(error => { peerCache.delete(code); throw error; });
        cached = { value, expires: Date.now() + 30000 }; peerCache.set(code, cached);
      }
      return cached.value;
    };
    peerLookup.current = peer;
    handler.current = createDiscoveryHandler({ getMyUserCode: async () => profile.user_code,
      getMyProfile: async () => ({ user_code: profile.user_code, interests: profile.interests }),
      findByCode: async code => { const found = await peer(code); return { user_code: found.user_code, interests: found.interests }; },
      saveMyInterests: async () => { throw new Error('Use the profile editor.'); },
    }, async code => calculateSkillMatch(skillsOf(profile), skillsOf(await peer(code)), profile.preferences.skill_mode).score);
    // A new encounter gets current remote data; avoid retaining another person's profile indefinitely.
  }, [setData, setProfile]);

  const handleFound = useCallback(async (event: FoundEvent) => {
    const activeHandler = handler.current, profile = matching.current, transport = client.current;
    if (!profile || !activeHandler || !transport || !configured.current || busyEvents.current.has(event.event_id)) return;
    if (completedEvents.current.has(event.event_id)) {
      await transport.send({ v: 1, type: 'ack_event', event_id: event.event_id }).catch(() => {});
      return;
    }
    const activeEpoch = epoch.current;
    busyEvents.current.add(event.event_id);
    try {
      let result = eventResults.current.get(event.event_id);
      if (!eventResults.current.has(event.event_id)) {
        // Network failures must retry before the discovery cooldown consumes a notification.
        if (event.source === 'infrared' || profile.preferences.self_search) await peerLookup.current?.(event.user_code);
        if (activeHandler !== handler.current || activeEpoch !== epoch.current) return;
        result = await activeHandler.handle(event, profile.preferences);
        if (activeHandler !== handler.current || activeEpoch !== epoch.current) return;
        eventResults.current.set(event.event_id, result);
      }
      if (result) {
        setLastMatch({ owner: profile.id, value: result });
        await transport.send(scoreCommand(event.event_id, result.interest_score, result.skill_score));
        if (activeEpoch !== epoch.current || activeHandler !== handler.current) return;
        if (result.should_notify) {
          const response = await networkAction('create', { user_code: result.user_code, source: result.source,
            mode: result.mode, interest_score: result.interest_score, skill_score: result.skill_score }, profile.id);
          if (response.push_warning) setNotice(response.push_warning);
          await refreshNetwork();
        }
      }
      if (activeEpoch === epoch.current) {
        completedEvents.current.add(event.event_id);
        await transport.send({ v: 1, type: 'ack_event', event_id: event.event_id });
      }
      // Leave cached results until profile/settings change: retries keep should_notify after an interrupted upload.
      if (eventResults.current.size > 200) {
        const oldest = eventResults.current.keys().next().value!;
        eventResults.current.delete(oldest); completedEvents.current.delete(oldest);
      }
    } catch (error) {
      if (activeEpoch === epoch.current) {
        setNotice(error instanceof Error ? error.message : 'Encounter could not sync. Reconnecting will retry.');
        if (error instanceof UnknownPeerError) {
          completedEvents.current.add(event.event_id);
          await transport.send(scoreCommand(event.event_id, null, null)).catch(() => {});
          await transport.send({ v: 1, type: 'ack_event', event_id: event.event_id }).catch(() => {});
        }
      }
    } finally { busyEvents.current.delete(event.event_id); }
  }, [refreshNetwork, setNotice]);
  const eventHandler = useRef(handleFound);
  useLayoutEffect(() => { eventHandler.current = handleFound; }, [handleFound]);

  useEffect(() => {
    const owner = session?.user.id;
    if (!owner || !ready) return;
    let active = true;
    const resultCache = eventResults.current, busyCache = busyEvents.current, messageCache = messageIds.current, completedCache = completedEvents.current;
    const currentEpoch = ++epoch.current;
    matching.current = null;
    token.current = null;
    const transport = new BoardClient({ onDevices: rows => { if (active) setDevices(rows); },
      onStatus: status => { if (active) { setBoardStatus(status); if (status.includes('disconnected')) configured.current = false; } },
      onEvent: event => {
        if (!active) return;
        if (event.type === 'hello' && matching.current) {
          configured.current = false;
          void transport.send({ v: 1, type: 'configure', user_code: matching.current.user_code,
            self_search: matching.current.preferences.self_search }).catch(error => setNotice(String(error)));
        } else if (event.type === 'ack' && event.command === 'configure') configured.current = true;
        else if (event.type === 'found') void eventHandler.current(event);
        else if (event.type === 'error') setNotice(event.message);
      } });
    client.current = transport;
    const stopNotifications = listenForNotifications(() => router.push({ pathname: '/section', params: { type: 'chats' } }));
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (active) void refreshNetwork().catch(error => setNotice(String(error))); }, 200);
    };
    const channel = supabase.channel('village-' + owner)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'village_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'village_messages' }, payload => {
        if (active) mergeMessages((payload.new as ServerMessage).request_id, [payload.new as ServerMessage], owner);
      }).subscribe();
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active' && active) {
        scheduleRefresh();
        for (const encounter of dataRef.current?.encounters ?? []) {
          void loadMessages(encounter.id).then(rows => mergeMessages(encounter.id, rows, owner)).catch(() => {});
        }
      }
    });
    async function initialize() {
      try {
      const profile = await loadMyProfile();
      if (!active || currentEpoch !== epoch.current) return;
      applyProfile(profile);
      await refreshNetwork();
      if (!active) return;
      const savedDevice = await AsyncStorage.getItem('hackvillage:board:' + owner);
      if (savedDevice && transport.supported && AppState.currentState === 'active') {
        await transport.connect(savedDevice).catch(error => { if (active) setBoardStatus(String(error)); });
      }
      if (transport.supported) {
        const registered = await registerNotifications(false).catch(() => null);
        if (active) { token.current = registered; setNotificationsEnabled(!!registered); }
      }
      if (active) setNotice('');
      } catch (error) {
        if (active) {
          setNotice(error instanceof Error ? error.message : 'Account could not sync.');
          retryTimer = setTimeout(() => void initialize(), 10000);
        }
      }
    }
    void initialize();
    return () => {
      active = false;
      // This numeric ref intentionally changes here to cancel work from this account.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      epoch.current++;
      configured.current = false;
      handler.current?.reset(); handler.current = null; matching.current = null; peerLookup.current = null;
      resultCache.clear(); busyCache.clear(); messageCache.clear(); completedCache.clear();
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      foreground.remove(); stopNotifications(); void supabase.removeChannel(channel); void transport.dispose();
      if (client.current === transport) client.current = null;
    };
  }, [session?.user.id, ready, applyProfile, refreshNetwork, mergeMessages, setNotice]);

  async function saveMatchingProfile(profile: MatchingProfile) {
    const owner = user.current;
    const saved = await saveProfile(profile);
    if (owner !== user.current) return;
    applyProfile(saved);
    if (configured.current) await client.current?.send({ v: 1, type: 'configure', user_code: saved.user_code, self_search: saved.preferences.self_search });
  }
  async function savePreferences(next: Preferences) {
    if (!matching.current) throw new Error('Wait for your profile to sync.');
    await saveMatchingProfile({ ...matching.current, preferences: next });
  }
  async function saveLookRemote(look: AvatarLook) {
    if (!matching.current) throw new Error('Wait for your profile to sync.');
    await saveMatchingProfile({ ...matching.current, look });
  }
  async function normalizeLabels(labels: string[], useAI: boolean): Promise<Interest[]> {
    if (!useAI) return exactTextInterests(labels);
    const store = createSupabaseStore({ url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
      publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, getSession: async () => {
        const { data, error } = await supabase.auth.getSession(); if (error) throw error; return data.session;
      } });
    return store.normalize(labels);
  }
  async function answerRequest(id: string, accept: boolean) {
    const owner = user.current;
    if (!owner) throw new Error('Please sign in again.');
    const response = await networkAction('respond', { request_id: id, accept }, owner);
    if (response.push_warning) setNotice(response.push_warning);
    await refreshNetwork();
  }
  async function sendMessageRemote(id: string, text: string): Promise<boolean> {
    const clean = text.trim(), owner = user.current;
    if (!clean || clean.length > 1000 || !owner) return false;
    const key = id + ':' + clean;
    const clientId = messageIds.current.get(key) ?? randomUUID(); messageIds.current.set(key, clientId);
    try {
      const response = await networkAction('message', { request_id: id, client_id: clientId, text: clean }, owner);
      mergeMessages(id, [response.result as ServerMessage], owner); messageIds.current.delete(key);
      if (response.push_warning) setNotice(response.push_warning);
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Message could not be sent. Try again.'); return false; }
  }
  const fetchMessages = useCallback(async (id: string, older = false) => {
    const owner = user.current; if (!owner) return;
    const first = dataRef.current?.encounters.find(encounter => encounter.id === id)?.messages[0];
    const rows = await loadMessages(id, older && first ? { createdAt: first.createdAt, id: first.id } : undefined);
    mergeMessages(id, rows, owner);
    if (owner === user.current) setHasOlder(current => ({ ...current, [id]: rows.length === 100 }));
  }, [mergeMessages]);
  async function connectBoard(id: string) {
    if (!matching.current || !user.current) throw new Error('Wait for your profile to sync before pairing.');
    await client.current?.connect(id);
    await AsyncStorage.setItem('hackvillage:board:' + user.current, id);
  }
  async function disconnectBoard() {
    if (user.current) await AsyncStorage.removeItem('hackvillage:board:' + user.current);
    if (configured.current) await client.current?.send({ v: 1, type: 'configure', user_code: null, self_search: false });
    await client.current?.disconnect(); configured.current = false;
  }
  async function enableNotifications() {
    token.current = await registerNotifications(true);
    setNotificationsEnabled(!!token.current);
    if (!token.current) throw new Error('Allow notifications in your phone settings to receive requests.');
  }
  async function signOut() {
    // Remove this device's remote push registration while its user session is still valid.
    if (token.current) await unregisterNotifications(token.current);
    await disconnectBoard().catch(() => {});
    const { error } = await supabase.auth.signOut(); if (error) throw error;
  }
  return { matchingProfile: activeProfile, preferences,
    requests: requests.filter(request => session?.user.id === request.user_a || session?.user.id === request.user_b),
    lastMatch: lastMatch?.owner === session?.user.id ? lastMatch?.value ?? null : null,
    boardStatus, devices, notificationsEnabled: !!activeProfile && notificationsEnabled, hasOlder,
    refreshNetwork, saveMatchingProfile, savePreferences, saveLookRemote, normalizeLabels, answerRequest, sendMessageRemote,
    fetchMessages, connectBoard, disconnectBoard, scanBoards: () => client.current?.scan(), enableNotifications, signOut };
}
