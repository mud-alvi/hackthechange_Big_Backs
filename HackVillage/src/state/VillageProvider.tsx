import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../../lib/supabase';
import { useVillageNetwork } from './useVillageNetwork';
import {
  BASE_LOOK,
  type AvatarLook,
  type EncounterInput,
  type Message,
  type VillageData,
} from '../types/village';

type Profile = { username: string; total_xp: number; user_code: string };
const emptyData = (): VillageData => ({ look: { ...BASE_LOOK }, encounters: [], motion: true });
const emptyProfile: Profile = { username: 'Villager', total_xp: 0, user_code: '' };
function validLook(value: unknown): value is AvatarLook {
  if (!value || typeof value !== 'object') return false;
  const v = value as AvatarLook;
  return (
    ['smirk', 'happy', 'sleepy', 'blank'].includes(v.face) &&
    ['none', 'violet', 'mint', 'pink', 'ink'].includes(v.shirt) &&
    ['none', 'cap', 'beanie', 'hair'].includes(v.headwear)
  );
}
function parseStored(raw: string): VillageData {
  const value = JSON.parse(raw) as Partial<VillageData>;
  const encounters = Array.isArray(value.encounters)
    ? value.encounters.filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.peerId === 'string' &&
          typeof e.name === 'string' &&
          Number.isFinite(Date.parse(e.metAt)) &&
          validLook(e.look) &&
          Array.isArray(e.messages) &&
          e.messages.every(
            (m) =>
              m &&
              typeof m.id === 'string' &&
              typeof m.text === 'string' &&
              ['me', 'them'].includes(m.sender) &&
              Number.isFinite(Date.parse(m.createdAt)),
          ) &&
          Number.isInteger(e.unread) &&
          e.unread >= 0,
      )
    : [];
  return {
    look: validLook(value.look) ? value.look : { ...BASE_LOOK },
    encounters,
    motion: value.motion !== false,
  };
}

function useVillageState() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [data, setData] = useState<VillageData>(emptyData);
  const [notice, setNotice] = useState('');
  const hydratedFor = useRef<string | null>(null);
  const persistenceQueue = useRef<Promise<unknown>>(Promise.resolve());
  const userId = session?.user.id;
  const fallbackName =
    typeof session?.user.user_metadata?.username === 'string'
      ? session.user.user_metadata.username
      : 'Villager';
  const ready = !!userId && hydratedUserId === userId;

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      if (active) {
        setSession(next);
        setAuthReady(true);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data: result, error }) => {
        if (!active || authEventReceived) return;
        if (error) setNotice(error.message);
        setSession(result.session);
        setAuthReady(true);
      })
      .catch(() => {
        if (active && !authEventReceived) {
          setNotice('Could not restore your session. Please sign in again.');
          setAuthReady(true);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    hydratedFor.current = null;
    if (!userId) return;
    void (async () => {
      let nextData = emptyData();
      let storageNotice = '';
      try {
        const raw = await AsyncStorage.getItem(`hackvillage:frontend:v1:${userId}`);
        if (raw) nextData = parseStored(raw);
      } catch {
        storageNotice = 'Saved appearance could not be loaded. You can customize it again.';
      }
      if (!active) return;
      setData(nextData);
      setProfile({ ...emptyProfile, username: fallbackName });
      setNotice(storageNotice);
      hydratedFor.current = userId;
      setHydratedUserId(userId);
    })().catch(() => {
      if (active)
        setNotice('Village stats could not be loaded. Your saved appearance is still available.');
    });
    return () => {
      active = false;
    };
  }, [userId, fallbackName]);

  useEffect(() => {
    if (!userId || !ready || hydratedFor.current !== userId) return;
    const key = `hackvillage:frontend:v1:${userId}`;
    const serialized = JSON.stringify(data);
    persistenceQueue.current = persistenceQueue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(key, serialized))
      .catch(() => {
        if (hydratedFor.current === userId)
          setNotice('Changes are visible, but this device could not save them.');
      });
  }, [data, ready, userId]);

  const recordEncounter = useCallback((input: EncounterInput) => {
    if (!hydratedFor.current) throw new Error('Wait for your village to load.');
    if (
      !input.encounterId ||
      !input.peerId ||
      !input.name ||
      !Number.isFinite(Date.parse(input.occurredAt))
    )
      throw new Error('Invalid encounter.');
    setData((current) => {
      // Repeated Arduino beeps from the same person keep one conversation.
      if (current.encounters.some((e) => e.peerId === input.peerId || e.id === input.encounterId))
        return current;
      return {
        ...current,
        encounters: [
          {
            id: input.encounterId,
            peerId: input.peerId,
            name: input.name,
            metAt: input.occurredAt,
            look: input.look || { ...BASE_LOOK },
            messages: [],
            unread: 0,
          },
          ...current.encounters,
        ],
      };
    });
  }, []);

  const addSampleEncounter = useCallback(() => {
    recordEncounter({
      encounterId: 'sample-encounter-alex',
      peerId: 'sample-alex',
      name: 'Alex · sample',
      occurredAt: new Date().toISOString(),
      look: { face: 'happy', shirt: 'mint', headwear: 'beanie' },
    });
  }, [recordEncounter]);

  const markRead = useCallback(
    (id: string) =>
      setData((current) => {
        if (!current.encounters.some((e) => e.id === id && e.unread > 0)) return current;
        return {
          ...current,
          encounters: current.encounters.map((e) => (e.id === id ? { ...e, unread: 0 } : e)),
        };
      }),
    [],
  );
  const setMotion = useCallback(
    (motion: boolean) => setData((current) => ({ ...current, motion })),
    [],
  );
  const clearSamples = useCallback(
    () =>
      setData((current) => ({
        ...current,
        encounters: current.encounters.filter((e) => !e.peerId.startsWith('sample-')),
      })),
    [],
  );
  const receiveMessage = useCallback((peerId: string, message: Omit<Message, 'sender'>) => {
    if (
      !hydratedFor.current ||
      !message.id ||
      !message.text.trim() ||
      message.text.length > 1000 ||
      !Number.isFinite(Date.parse(message.createdAt))
    )
      return;
    setData((current) => ({
      ...current,
      encounters: current.encounters.map((e) =>
        e.peerId === peerId && !e.messages.some((m) => m.id === message.id)
          ? {
              ...e,
              messages: [...e.messages, { ...message, sender: 'them' }],
              unread: e.unread + 1,
            }
          : e,
      ),
    }));
  }, []);
  const network = useVillageNetwork({ session, ready, setData, setProfile, setNotice });
  return {
    ...network,
    session,
    authReady,
    ready,
    profile,
    data,
    notice,
    saveLook: network.saveLookRemote,
    setMotion,
    recordEncounter,
    addSampleEncounter,
    sendMessage: network.sendMessageRemote,
    receiveMessage,
    markRead,
    clearSamples,
  };
}

type VillageContextValue = ReturnType<typeof useVillageState>;
const VillageContext = createContext<VillageContextValue | null>(null);
export function VillageProvider({ children }: { children: ReactNode }) {
  const value = useVillageState();
  return <VillageContext.Provider value={value}>{children}</VillageContext.Provider>;
}
export function useVillage() {
  const value = useContext(VillageContext);
  if (!value) throw new Error('useVillage must be inside VillageProvider.');
  return value;
}
