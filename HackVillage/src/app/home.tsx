import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../components/village/Avatar';
import { BottomNav } from '../components/village/Navigation';
import { ScreenGate } from '../components/village/ScreenGate';
import { C, F, ui } from '../constants/villageTheme';
import { useVillage } from '../state/VillageProvider';

export default function HomeScreen() {
  return (
    <ScreenGate>
      <Home />
    </ScreenGate>
  );
}
function Home() {
  const { profile, data, notice } = useVillage();
  const { height, width } = useWindowDimensions();
  const size = Math.min(width - 48, height < 750 ? 250 : 290);
  const level = Math.floor(profile.total_xp / 500) + 1;
  const xp = profile.total_xp % 500;
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>
              hackvillage<Text style={{ color: C.violet }}>.</Text>
            </Text>
            <Text style={s.tagline}>little moments. real connections.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={() => router.push({ pathname: '/section', params: { type: 'profile' } })}
            style={({ pressed }) => [s.level, pressed && ui.pressed]}
          >
            <Text style={s.levelText}>LVL {level}</Text>
          </Pressable>
        </View>
        <View style={s.intro}>
          <Text style={s.eyebrow}>YOUR LITTLE CORNER OF THE WORLD</Text>
          <Text style={s.greeting}>
            Hey, {profile.username}
            <Text style={{ color: C.violet }}>!</Text>
          </Text>
          <Text style={s.subtitle}>Good things start with a hello.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Customize your avatar"
          style={s.hero}
          onPress={() => router.push({ pathname: '/section', params: { type: 'profile' } })}
        >
          <Text style={[s.spark, { top: 55, left: '13%' }]}>✦</Text>
          <Text style={[s.spark, { top: 110, right: '11%', fontSize: 13, color: '#C8BFF5' }]}>
            ✧
          </Text>
          <Avatar look={data.look} size={size} motion={data.motion} />
          <View style={s.customize}>
            <Text style={s.customizeText}>make it yours ↗</Text>
          </View>
        </Pressable>
        <View style={s.identity}>
          <Text style={s.handle}>@{profile.username}</Text>
          <View style={s.progress}>
            <View style={[s.fill, { width: `${xp / 5}%` }]} />
          </View>
          <Text style={s.xp}>
            {xp} / 500 XP · level {level}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open chats"
          onPress={() => router.push({ pathname: '/section', params: { type: 'chats' } })}
          style={({ pressed }) => [s.connection, pressed && ui.pressed]}
        >
          <View style={s.connectionIcon}>
            <Text style={{ color: C.violet, fontSize: 23 }}>⌁</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.connectionTitle}>
              {data.encounters.length
                ? `${data.encounters.length} ${data.encounters.length === 1 ? 'hello' : 'hellos'} to keep going`
                : 'A beep. A hello. A new friend.'}
            </Text>
            <Text style={s.connectionBody}>
              {data.encounters.length
                ? 'Pick up a conversation in Chats.'
                : 'Your in-person connections will live in Chats.'}
            </Text>
          </View>
          <Text style={s.arrow}>↗</Text>
        </Pressable>
        {!!notice && (
          <Text style={[ui.caption, { paddingHorizontal: 24, textAlign: 'center' }]}>{notice}</Text>
        )}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingTop: 14,
    paddingBottom: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
  },
  brand: { fontFamily: F.bold, fontSize: 25, color: C.ink, letterSpacing: -0.9 },
  tagline: { fontFamily: F.regular, color: C.muted, fontSize: 10, marginTop: 1 },
  level: {
    borderWidth: 1,
    borderColor: '#DDD7F7',
    backgroundColor: '#FAF9FE',
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  levelText: { fontFamily: F.medium, fontSize: 11, color: C.violet },
  intro: { alignItems: 'center', marginTop: 34, paddingHorizontal: 20 },
  eyebrow: { fontFamily: F.medium, fontSize: 9, letterSpacing: 2, color: '#9B94AD' },
  greeting: {
    fontFamily: F.bold,
    fontSize: 31,
    color: C.ink,
    marginTop: 10,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  subtitle: { fontFamily: F.regular, color: C.muted, fontSize: 14, marginTop: 5 },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 6,
    paddingBottom: 16,
    minHeight: 290,
  },
  spark: { position: 'absolute', fontSize: 22, color: '#AA9BEF' },
  customize: {
    position: 'absolute',
    bottom: 0,
    right: '13%',
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    transform: [{ rotate: '-6deg' }],
  },
  customizeText: { fontFamily: F.medium, fontSize: 10, color: C.violet },
  identity: { alignItems: 'center', paddingTop: 12, paddingBottom: 26 },
  handle: { fontFamily: F.medium, fontSize: 17, color: C.ink },
  progress: {
    width: 128,
    height: 4,
    backgroundColor: C.light,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  fill: { height: '100%', backgroundColor: C.violet, borderRadius: 4 },
  xp: { fontFamily: F.regular, color: C.muted, fontSize: 10, marginTop: 7 },
  connection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8F7FD',
    borderWidth: 1,
    borderColor: '#EFECF9',
    borderRadius: 20,
    marginHorizontal: 24,
    padding: 15,
    marginTop: 'auto',
  },
  connectionIcon: {
    width: 35,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBE6FE',
  },
  connectionTitle: { fontFamily: F.medium, fontSize: 13, color: C.ink },
  connectionBody: { fontFamily: F.regular, fontSize: 11, color: C.muted, marginTop: 4 },
  arrow: { fontSize: 20, color: C.violet },
});