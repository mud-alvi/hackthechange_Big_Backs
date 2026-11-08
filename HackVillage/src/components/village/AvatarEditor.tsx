import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F, ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';
import { BASE_LOOK, type AvatarLook } from '../../types/village';
import { Avatar } from './Avatar';

type Category = keyof AvatarLook;
const categories: { id: Category; label: string }[] = [
  { id: 'shirt', label: 'Shirts' },
  { id: 'face', label: 'Faces' },
  { id: 'headwear', label: 'Hair & hats' },
];
const options = {
  shirt: [
    { id: 'none', label: 'Baseline', symbol: '○', color: '#FFF' },
    { id: 'violet', label: 'Violet', symbol: '</>', color: '#8872F0' },
    { id: 'mint', label: 'Mint', symbol: '</>', color: '#A2D7BE' },
    { id: 'pink', label: 'Rose', symbol: '</>', color: '#F1A4C6' },
    { id: 'ink', label: 'Midnight', symbol: '</>', color: '#292737' },
  ],
  face: [
    { id: 'smirk', label: 'Smirk', symbol: '⌐‿⌐', color: '#FFF' },
    { id: 'happy', label: 'Happy', symbol: '•ᴗ•', color: '#FFF' },
    { id: 'sleepy', label: 'Sleepy', symbol: '–.ـ', color: '#FFF' },
    { id: 'blank', label: 'Blank', symbol: '◡', color: '#FFF' },
  ],
  headwear: [
    { id: 'none', label: 'None', symbol: '○', color: '#FFF' },
    { id: 'hair', label: 'Soft fringe', symbol: '〰', color: '#3B2A28' },
    { id: 'cap', label: 'Village cap', symbol: '✦', color: '#8872F0' },
    { id: 'beanie', label: 'Cozy beanie', symbol: '▤', color: '#A2D7BE' },
  ],
};
export function AvatarEditor() {
  const { data, profile, saveLook } = useVillage();
  const [draft, setDraft] = useState<AvatarLook>({ ...data.look });
  const [category, setCategory] = useState<Category>('shirt');
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.look);
  function choose(value: string) {
    setDraft((current) => ({ ...current, [category]: value }));
    setSaved(false);
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ui.page}>
      <View>
        <Text style={ui.title}>A little more you.</Text>
        <Text style={[ui.body, { marginTop: 5 }]}>Same little villager. Your own personality.</Text>
      </View>
      <View style={s.stage}>
        <View style={s.previewLabel}>
          <Text style={s.previewText}>YOUR AVATAR</Text>
        </View>
        <Avatar look={draft} size={230} motion={data.motion} />
        <Text style={s.username}>@{profile.username}</Text>
        <Text style={ui.caption}>
          Level {Math.floor(profile.total_xp / 500) + 1} · {profile.total_xp} total XP
        </Text>
      </View>
      <View style={s.categoryRow}>
        {categories.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === item.id }}
            onPress={() => setCategory(item.id)}
            style={[s.category, category === item.id && s.categoryActive]}
          >
            <Text style={[s.categoryText, category === item.id && { color: C.violet }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.options}>
        {options[category].map((item) => {
          const selected = draft[category] === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.label} ${category}`}
              accessibilityState={{ selected }}
              onPress={() => choose(item.id)}
              style={({ pressed }) => [s.option, selected && s.optionActive, pressed && ui.pressed]}
            >
              <View style={[s.swatch, { backgroundColor: item.color }]}>
                <Text
                  style={{
                    fontSize: category === 'shirt' ? 15 : 23,
                    fontWeight: '700',
                    color: ['#292737', '#3B2A28', '#8872F0'].includes(item.color) ? '#FFF' : C.ink,
                  }}
                >
                  {item.symbol}
                </Text>
              </View>
              <Text style={[s.optionLabel, selected && { color: C.violet }]}>{item.label}</Text>
              {selected && <Text style={s.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
      <View style={ui.row}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            ui.button,
            { flex: 1, opacity: dirty ? 1 : 0.6 },
            pressed && ui.pressed,
          ]}
          disabled={!dirty}
          onPress={() => {
            saveLook({ ...draft });
            setSaved(true);
          }}
        >
          <Text style={ui.buttonText}>Save my look</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[ui.button, ui.subtle]}
          onPress={() => {
            setDraft({ ...BASE_LOOK });
            setSaved(false);
          }}
        >
          <Text style={[ui.buttonText, ui.subtleText]}>Reset</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={[ui.caption, { textAlign: 'center' }]}>
        {dirty
          ? 'Previewing changes · save to update your homepage.'
          : saved
            ? 'Look saved on this device. Looking good!'
            : 'Your look is saved on this device.'}
      </Text>
      <View style={ui.card}>
        <Text style={ui.heading}>Your village</Text>
        <View style={ui.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.stat}>{data.encounters.length}</Text>
            <Text style={ui.caption}>Connections</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.stat}>{profile.total_xp}</Text>
            <Text style={ui.caption}>Total XP</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.stat}>{Math.floor(profile.total_xp / 500) + 1}</Text>
            <Text style={ui.caption}>Level</Text>
          </View>
        </View>
        {!!profile.user_code && <Text style={ui.body}>Village code: {profile.user_code}</Text>}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  stage: {
    backgroundColor: '#FAF9FF',
    borderWidth: 1,
    borderColor: '#F0ECFC',
    borderRadius: 28,
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 20,
    gap: 5,
  },
  previewLabel: { position: 'absolute', top: 16, left: 18 },
  previewText: { fontFamily: F.medium, fontSize: 9, letterSpacing: 1.5, color: '#A29AB7' },
  username: { fontFamily: F.medium, fontSize: 17, marginTop: 8, color: C.ink },
  categoryRow: { flexDirection: 'row', padding: 4, backgroundColor: '#F6F5F9', borderRadius: 16 },
  category: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  categoryActive: { backgroundColor: '#FFF' },
  categoryText: { fontFamily: F.medium, fontSize: 14, color: C.muted },
  options: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  option: {
    width: '30%',
    flexGrow: 1,
    maxWidth: '32%',
    minHeight: 100,
    padding: 10,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: 18,
    alignItems: 'center',
    gap: 8,
  },
  optionActive: { borderColor: C.violet, backgroundColor: '#FAF9FF' },
  swatch: {
    width: 45,
    height: 42,
    borderWidth: 1,
    borderColor: '#E5E1EE',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontFamily: F.medium, fontSize: 11, color: C.muted, textAlign: 'center' },
  check: { position: 'absolute', right: 6, top: 3, color: C.violet, fontSize: 12 },
  stat: { fontFamily: F.bold, color: C.violet, fontSize: 26 },
});
