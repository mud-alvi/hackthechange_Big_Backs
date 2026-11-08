import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';

export function NetworkSettings() {
  const { matchingProfile } = useVillage();
  if (!matchingProfile) return <Text style={ui.body}>Account sync is needed before connecting a board.</Text>;
  return <NetworkSettingsForm key={matchingProfile.id} />;
}
function NetworkSettingsForm() {
  const village = useVillage();
  const { preferences, matchingProfile } = village;
  const [minimum, setMinimum] = useState(String(preferences.minimum_score));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function run(action: () => unknown | Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not complete this action.'); }
    finally { setBusy(false); }
  }
  return <>
    <View style={ui.card}>
      <Text style={ui.heading}>Your board</Text><Text style={ui.body}>{village.boardStatus}</Text>
      <Text style={ui.caption}>Match the HV name below to the name on your board’s screen. Hold its button for 3 seconds to change its owner.</Text>
      <Pressable disabled={busy || !matchingProfile} onPress={() => void run(village.scanBoards)} style={ui.button}><Text style={ui.buttonText}>Find my board</Text></Pressable>
      {village.devices.map(device => <Pressable key={device.id} disabled={busy} onPress={() => void run(() => village.connectBoard(device.id))} style={[ui.button, ui.subtle]}>
        <Text style={[ui.buttonText, ui.subtleText]}>{device.name}{device.rssi !== null ? ` · ${device.rssi} dBm` : ''}</Text>
      </Pressable>)}
      <Pressable disabled={busy} onPress={() => void run(village.disconnectBoard)} style={[ui.button, ui.subtle]}><Text style={[ui.buttonText, ui.subtleText]}>Disconnect my board</Text></Pressable>
    </View>
    <View style={ui.card}>
      <Text style={ui.heading}>Find your people</Text>
      <View style={ui.row}><Text style={[ui.body, { flex: 1 }]}>Self-search</Text><Switch accessibilityLabel="Automatic board discovery" disabled={busy || !matchingProfile} value={preferences.self_search} onValueChange={value => void run(() => village.savePreferences({ ...preferences, self_search: value }))} /></View>
      <Text style={ui.caption}>Your board automatically discovers nearby boards when this is on. Manual IR uses the board button in either mode.</Text>
      <Text style={ui.caption}>Match using</Text><View style={[ui.row, { flexWrap: 'wrap' }]}>{(['interests', 'skills', 'both'] as const).map(mode => <Pressable key={mode} disabled={busy || !matchingProfile} onPress={() => void run(() => village.savePreferences({ ...preferences, mode }))} style={[ui.button, preferences.mode !== mode && ui.subtle]}>
        <Text style={[ui.buttonText, preferences.mode !== mode && ui.subtleText]}>{mode}</Text></Pressable>)}</View>
      <Text style={ui.caption}>Skill matching</Text>{([['exchange', 'Teach each other'], ['collaboration', 'Find project collaborators'], ['learning', 'Learn together']] as const).map(([mode, title]) => <Pressable key={mode} disabled={busy || !matchingProfile} onPress={() => void run(() => village.savePreferences({ ...preferences, skill_mode: mode }))} style={[ui.button, preferences.skill_mode !== mode && ui.subtle]}>
        <Text style={[ui.buttonText, preferences.skill_mode !== mode && ui.subtleText]}>{title}</Text></Pressable>)}
      <Text style={ui.caption}>Minimum automatic match percentage</Text><TextInput accessibilityLabel="Minimum match percentage" keyboardType="decimal-pad" editable={!busy} style={ui.input} value={minimum} onChangeText={setMinimum} />
      <Pressable disabled={busy || !matchingProfile} onPress={() => void run(async () => {
        const value = Number(minimum); if (!minimum.trim() || !Number.isFinite(value) || value < 0 || value > 100) throw new Error('Enter a number from 0 to 100.');
        await village.savePreferences({ ...preferences, minimum_score: value });
      })} style={ui.button}><Text style={ui.buttonText}>Save minimum</Text></Pressable>
      <Text style={ui.caption}>A request is suggested when either selected score reaches the minimum. Both people still choose whether to connect.</Text>
    </View>
    <View style={ui.card}><Text style={ui.heading}>Request notifications</Text><Text style={ui.body}>{village.notificationsEnabled ? 'Enabled on this phone.' : 'Enable notifications to receive requests while the app is in the background.'}</Text>
      <Pressable disabled={busy} onPress={() => void run(village.enableNotifications)} style={ui.button}><Text style={ui.buttonText}>Enable notifications</Text></Pressable>
    </View>
    {!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
  </>;
}
