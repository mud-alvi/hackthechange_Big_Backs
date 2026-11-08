import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';

export type Tab = 'profile' | 'games' | 'coding' | 'chats' | 'settings';
export function Icon({ name, color = C.ink }: { name: Tab; color?: string }) {
  if (name === 'profile')
    return (
      <View style={s.icon}>
        <View style={[s.personHead, { backgroundColor: color }]} />
        <View style={[s.personBody, { backgroundColor: color }]} />
      </View>
    );
  if (name === 'games')
    return (
      <View style={s.icon}>
        <View style={[s.game, { borderColor: color }]}>
          <View style={[s.crossH, { backgroundColor: color }]} />
          <View style={[s.crossV, { backgroundColor: color }]} />
          <View style={[s.dot, { backgroundColor: color }]} />
        </View>
      </View>
    );
  if (name === 'chats')
    return (
      <View style={s.icon}>
        <View style={[s.bubble, { borderColor: color }]}>
          <View style={[s.bubbleLine, { backgroundColor: color }]} />
          <View style={[s.bubbleLine, { width: 8, backgroundColor: color }]} />
        </View>
        <View style={[s.tail, { borderColor: color }]} />
      </View>
    );
  return (
    <View style={s.icon}>
      <Text
        style={{ fontSize: name === 'coding' ? 18 : 29, fontWeight: '700', color, lineHeight: 30 }}
      >
        {name === 'coding' ? '</>' : '⚙'}
      </Text>
    </View>
  );
}
const tabs: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'games', label: 'Games' },
  { id: 'coding', label: 'Code' },
  { id: 'chats', label: 'Chats' },
  { id: 'settings', label: 'Settings' },
];
export function BottomNav({ active }: { active?: Tab }) {
  const { data } = useVillage();
  const unread = data.encounters.reduce((sum, e) => sum + e.unread, 0);
  return (
    <View style={s.nav}>
      <View style={s.navInner}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active === tab.id }}
            onPress={() => router.replace({ pathname: '/section', params: { type: tab.id } })}
            style={({ pressed }) => [s.navItem, pressed && ui.pressed]}
          >
            <View style={[s.iconWrap, active === tab.id && s.selected]}>
              <Icon name={tab.id} color={active === tab.id ? C.violet : C.ink} />
              {tab.id === 'chats' && unread > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </View>
            <Text style={[s.label, active === tab.id && { color: C.violet }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function PageHeader({ title, back = 'home' }: { title: string; back?: 'home' | 'chats' }) {
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={back === 'home' ? 'Back to home' : 'Back to chats'}
        hitSlop={10}
        style={({ pressed }) => [s.back, pressed && ui.pressed]}
        onPress={() =>
          router.replace(
            back === 'home' ? '/home' : { pathname: '/section', params: { type: 'chats' } },
          )
        }
      >
        <Text style={s.backArrow}>‹</Text>
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}
const s = StyleSheet.create({
  nav: { backgroundColor: C.paper },
  navInner: {
    flexDirection: 'row',
    borderTopWidth: 3,
    borderColor: C.ink,
    paddingTop: 10,
    paddingBottom: 8,
    width: '92%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  navItem: { flex: 1, minHeight: 58, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 45,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  selected: { backgroundColor: C.light },
  label: { fontFamily: F.medium, fontSize: 10, color: C.muted },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  personHead: { width: 10, height: 11, borderRadius: 8 },
  personBody: { width: 19, height: 12, borderRadius: 8, marginTop: 2 },
  game: {
    width: 26,
    height: 19,
    borderWidth: 2.5,
    borderRadius: 7,
    transform: [{ rotate: '-5deg' }],
  },
  crossH: { position: 'absolute', left: 3, top: 6, width: 8, height: 2 },
  crossV: { position: 'absolute', left: 6, top: 3, width: 2, height: 8 },
  dot: { position: 'absolute', right: 3, top: 5, width: 4, height: 4, borderRadius: 3 },
  bubble: {
    width: 25,
    height: 20,
    borderWidth: 2.3,
    borderRadius: 7,
    gap: 3,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  bubbleLine: { width: 12, height: 2, borderRadius: 2 },
  tail: {
    position: 'absolute',
    bottom: 0,
    left: 4,
    width: 6,
    height: 7,
    borderLeftWidth: 2.3,
    borderBottomWidth: 2.3,
    backgroundColor: C.paper,
    transform: [{ skewY: '-30deg' }],
  },
  badge: {
    position: 'absolute',
    right: -3,
    top: -2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    backgroundColor: C.violet,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  headerTitle: { fontFamily: F.medium, fontSize: 17, color: C.ink },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#F7F6FA',
  },
  backArrow: { color: C.ink, fontSize: 32, lineHeight: 35 },
});
