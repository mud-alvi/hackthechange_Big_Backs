import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { C, ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';

export function Settings() {
  const { data, setMotion, session, clearSamples } = useVillage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function logout() {
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not sign out. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView contentContainerStyle={ui.page}>
      <View>
        <Text style={ui.title}>Just how you like it.</Text>
        <Text style={ui.body}>A few little things for your village.</Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.heading}>Your account</Text>
        <Text selectable style={ui.body}>
          {session?.user.email}
        </Text>
      </View>
      <View style={ui.card}>
        <View style={ui.row}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={ui.heading}>A little motion</Text>
            <Text style={ui.body}>Let your avatar gently float.</Text>
          </View>
          <Switch
            accessibilityLabel="Avatar animation"
            value={data.motion}
            onValueChange={setMotion}
            trackColor={{ false: '#DDD9E8', true: '#B9AAF7' }}
            thumbColor={data.motion ? C.violet : '#FFF'}
          />
        </View>
        <Text style={ui.caption}>Your device’s Reduce Motion setting takes priority.</Text>
      </View>
      <View style={ui.card}>
        <Text style={ui.heading}>Preview data</Text>
        <Text style={ui.body}>
          Appearance and sample chats are stored on this device, separately for each account.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            clearSamples();
            setMessage('Sample encounters and their messages were cleared.');
          }}
          style={[ui.button, ui.subtle]}
        >
          <Text style={[ui.buttonText, ui.subtleText]}>Clear sample chats</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={logout}
        style={({ pressed }) => [ui.button, { backgroundColor: '#F8EBF0' }, pressed && ui.pressed]}
      >
        <Text style={[ui.buttonText, { color: '#A34766' }]}>
          {busy ? 'Signing out…' : 'Log out'}
        </Text>
      </Pressable>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={ui.body}>
          {message}
        </Text>
      )}
      <Text style={[ui.caption, { textAlign: 'center' }]}>
        HackVillage · make room for a new hello.
      </Text>
    </ScrollView>
  );
}
