import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { C, F, ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';
import type { Encounter, Message } from '../../types/village';
import { Avatar } from './Avatar';
import { ConnectionRequests } from './ConnectionRequests';

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
export function Chats() {
  const { data, refreshNetwork, lastMatch, notice } = useVillage();
  const [refreshError, setRefreshError] = useState('');
  const [query, setQuery] = useState('');
  const filtered = data.encounters.filter((e) =>
    e.name.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={ui.page}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <Text style={ui.title}>Keep the hello going.</Text>
        <Text style={[ui.body, { marginTop: 5 }]}>The people you meet, all in one place.</Text>
      </View>
      <View style={[ui.card, { backgroundColor: C.light, borderWidth: 0 }]}>
        <Text style={[ui.heading, { fontSize: 17, color: C.violet }]}>
          Meet in person. Connect here.
        </Text>
        <Text style={ui.body}>
          Your board finds nearby people. Accept a request together to start a conversation.
        </Text>
        <Text style={ui.caption}>
          Your interest and skill scores are shown separately.
        </Text>
      </View>
      <ConnectionRequests />
      {lastMatch && <Text style={ui.caption}>Last match with {lastMatch.user_code}: I {lastMatch.interest_score ?? '—'} · S {lastMatch.skill_score ?? '—'}</Text>}
      {!!notice && <Text style={ui.body}>{notice}</Text>}
      {!!data.encounters.length && (
        <TextInput
          accessibilityLabel="Search connections"
          style={ui.input}
          placeholder="Find someone in your village…"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
        />
      )}
      {filtered.map((encounter) => (
        <ChatRow key={encounter.id} encounter={encounter} />
      ))}
      {!filtered.length && (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Text style={{ color: C.violet, fontSize: 33 }}>⌁</Text>
          </View>
          <Text style={ui.heading}>
            {query ? 'No matching villagers' : 'Your next hello is out there.'}
          </Text>
          <Text style={[ui.body, { textAlign: 'center' }]}>
            {query
              ? 'Try a different name.'
              : 'Accepted connections will appear here. Check pending requests above.'}
          </Text>
        </View>
      )}
      <Pressable accessibilityRole="button" style={[ui.button, ui.subtle]} onPress={() => {
        setRefreshError(''); void refreshNetwork().catch(error => setRefreshError(String(error)));
      }}><Text style={[ui.buttonText, ui.subtleText]}>Refresh connections</Text></Pressable>
      {!!refreshError && <Text style={ui.body}>{refreshError}</Text>}
    </ScrollView>
  );
}
function ChatRow({ encounter }: { encounter: Encounter }) {
  const latest = encounter.messages[encounter.messages.length - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${encounter.name}`}
      onPress={() =>
        router.push({ pathname: '/section', params: { type: 'chat', id: encounter.id } })
      }
      style={({ pressed }) => [s.chatRow, pressed && ui.pressed]}
    >
      <View style={s.avatarTile}>
        <Avatar look={encounter.look} size={57} platform={false} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text numberOfLines={1} style={s.name}>
          {encounter.name}
        </Text>
        <Text numberOfLines={1} style={ui.caption}>
          {latest
            ? `${latest.sender === 'me' ? 'You: ' : ''}${latest.text}`
            : 'You met! Say your first hello.'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={[ui.caption, { fontSize: 10 }]}>
          {new Date(latest?.createdAt || encounter.metAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
        {encounter.unread > 0 ? (
          <View style={s.unread}>
            <Text style={{ color: '#FFF', fontSize: 11 }}>{encounter.unread}</Text>
          </View>
        ) : (
          <Text style={{ color: C.muted }}>›</Text>
        )}
      </View>
    </Pressable>
  );
}

export function ChatThread({ id }: { id: string }) {
  const { data, sendMessage, markRead, fetchMessages, hasOlder, notice } = useVillage();
  const [loadError, setLoadError] = useState('');
  const encounter = data.encounters.find((e) => e.id === id);
  const [draft, setDraft] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const sending = useRef(false);
  useEffect(() => {
    void fetchMessages(id).catch(error => setLoadError(String(error)));
  }, [id, fetchMessages]);
  useEffect(() => {
    if (encounter?.unread) markRead(id);
  }, [encounter?.unread, id, markRead]);
  if (!encounter)
    return (
      <View style={ui.page}>
        <Text style={ui.heading}>Conversation not found</Text>
        <Text style={ui.body}>Return to Chats to choose a connection.</Text>
        <Pressable
          style={ui.button}
          onPress={() => router.replace({ pathname: '/section', params: { type: 'chats' } })}
        >
          <Text style={ui.buttonText}>Back to Chats</Text>
        </Pressable>
      </View>
    );
  async function send() {
    if (sending.current) return;
    sending.current = true;
    try { if (await sendMessage(id, draft)) setDraft(''); }
    finally { sending.current = false; }
  }
  return (
    <KeyboardAvoidingView style={s.thread} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.threadHeader}>
        <View style={s.avatarTile}>
          <Avatar look={encounter.look} size={48} platform={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{encounter.name}</Text>
          <Text style={ui.caption}>
            Connected in person · {new Date(encounter.metAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <Text style={s.localBanner}>You both accepted this connection.</Text>
      {!!(loadError || notice) && <Text style={[ui.caption, { paddingHorizontal: 20 }]}>{loadError || notice}</Text>}
      {hasOlder[id] && <Pressable onPress={() => { void fetchMessages(id, true).catch(error => setLoadError(String(error))); }} style={[ui.button, ui.subtle]}><Text style={[ui.buttonText, ui.subtleText]}>Load older messages</Text></Pressable>}
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={encounter.messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.messages}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={s.firstHello}>
            <Text style={s.hello}>hello, new friend.</Text>
            <Text style={[ui.body, { textAlign: 'center' }]}>
              You have a beep in common. See what else you share.
            </Text>
            <View style={{ gap: 8, marginTop: 12 }}>
              {['Hey! Great meeting you 👋', 'What are you building?', 'Want to team up?'].map(
                (text) => (
                  <Pressable
                    accessibilityRole="button"
                    key={text}
                    style={s.prompt}
                    onPress={() => setDraft(text)}
                  >
                    <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.violet }}>
                      {text}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          </View>
        }
        renderItem={({ item }: { item: Message }) => (
          <View
            style={[s.messageWrap, { alignSelf: item.sender === 'me' ? 'flex-end' : 'flex-start' }]}
          >
            <View style={[s.message, item.sender === 'me' ? s.mine : s.theirs]}>
              <Text selectable style={[s.messageText, item.sender === 'me' && { color: '#FFF' }]}>
                {item.text}
              </Text>
            </View>
            <Text style={s.messageTime}>
              {timeLabel(item.createdAt)}
              {item.sender === 'me' ? ' · sent' : ''}
            </Text>
          </View>
        )}
      />
      <View style={s.composer}>
        <TextInput
          accessibilityLabel="Message"
          value={draft}
          onChangeText={setDraft}
          placeholder="Say a little hello…"
          placeholderTextColor={C.muted}
          style={[ui.input, s.messageInput]}
          multiline
          maxLength={1000}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          onPress={() => void send()}
          style={({ pressed }) => [
            s.send,
            !draft.trim() && { opacity: 0.35 },
            pressed && ui.pressed,
          ]}
        >
          <Text style={{ color: '#FFF', fontSize: 24 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 22, gap: 12 },
  emptyIcon: {
    width: 70,
    height: 70,
    backgroundColor: C.light,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 88,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 10,
  },
  avatarTile: {
    width: 58,
    height: 66,
    backgroundColor: '#F4F1FD',
    borderRadius: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  name: { fontFamily: F.medium, fontSize: 17, color: C.ink },
  unread: {
    backgroundColor: C.violet,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  thread: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  localBanner: {
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#F8F7FD',
    color: C.muted,
    fontFamily: F.regular,
    fontSize: 10,
  },
  messages: { padding: 20, gap: 15, flexGrow: 1 },
  firstHello: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  hello: { color: C.ink, fontSize: 25, fontFamily: F.bold, textAlign: 'center' },
  prompt: {
    borderWidth: 1,
    borderColor: '#E1DAFA',
    backgroundColor: '#FAF9FF',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    alignItems: 'center',
  },
  messageWrap: { maxWidth: '84%', gap: 5 },
  message: { borderRadius: 19, paddingHorizontal: 15, paddingVertical: 11 },
  mine: { backgroundColor: C.violet, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: '#F2F1F6', borderBottomLeftRadius: 5 },
  messageText: { fontFamily: F.regular, fontSize: 16, lineHeight: 22, color: C.ink },
  messageTime: { fontFamily: F.regular, color: C.muted, fontSize: 9, paddingHorizontal: 3 },
  composer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderColor: C.line,
    alignItems: 'flex-end',
  },
  messageInput: { flex: 1, maxHeight: 120 },
  send: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
