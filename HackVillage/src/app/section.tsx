import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from 'react-native';
import { Games, Coding } from '../components/village/Activities';
import { AvatarEditor } from '../components/village/AvatarEditor';
import { Chats, ChatThread } from '../components/village/Chats';
import { BottomNav, PageHeader, type Tab } from '../components/village/Navigation';
import { ScreenGate } from '../components/village/ScreenGate';
import { Settings } from '../components/village/Settings';
import { ui } from '../constants/villageTheme';

const titles: Record<string, string> = {
  profile: 'Your profile',
  games: 'Village games',
  coding: 'Coding corner',
  chats: 'Your connections',
  settings: 'Settings',
  chat: 'A new hello',
};
export default function SectionScreen() {
  const params = useLocalSearchParams<{ type?: string | string[]; id?: string | string[] }>();
  const type = typeof params.type === 'string' ? params.type : 'profile';
  const id = typeof params.id === 'string' ? params.id : '';
  const active = ['profile', 'games', 'coding', 'chats', 'settings'].includes(type)
    ? (type as Tab)
    : undefined;
  return (
    <ScreenGate>
      <SafeAreaView style={ui.screen}>
        <PageHeader
          title={titles[type] || 'Your village'}
          back={type === 'chat' ? 'chats' : 'home'}
        />
        {type === 'profile' ? (
          <AvatarEditor />
        ) : type === 'games' ? (
          <Games />
        ) : type === 'coding' ? (
          <Coding />
        ) : type === 'chats' ? (
          <Chats />
        ) : type === 'chat' ? (
          <ChatThread key={id} id={id} />
        ) : type === 'settings' ? (
          <Settings />
        ) : (
          <View style={ui.page}>
            <Text style={ui.heading}>Choose a corner of your village below.</Text>
          </View>
        )}
        {type !== 'chat' && <BottomNav active={active} />}
      </SafeAreaView>
    </ScreenGate>
  );
}
