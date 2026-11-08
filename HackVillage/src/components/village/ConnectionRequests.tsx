import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';

const percentage = (score: number | null) => score === null ? '—' : `${Number(score).toFixed(1)}%`;
export function ConnectionRequests() {
  const { requests, session, answerRequest } = useVillage();
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function reply(id: string, accept: boolean) {
    setBusy(id); setError('');
    try { await answerRequest(id, accept); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your response could not be saved.'); }
    finally { setBusy(''); }
  }
  return <>
    {requests.map(request => {
      const mine = request.user_a === session?.user.id ? request.a_accepted : request.b_accepted;
      return <View key={request.id} style={ui.card}>
        <Text style={ui.heading}>{request.peer_name} · {request.peer_code}</Text>
        <Text style={ui.body}>Interests {percentage(request.interest_score)} · Skills {percentage(request.skill_score)}</Text>
        <Text style={ui.caption}>{mine ? 'You accepted. Waiting for the other person.' : 'You both need to accept before chat opens.'}</Text>
        {mine === null && <View style={ui.row}>
          <Pressable disabled={!!busy} onPress={() => void reply(request.id, true)} style={[ui.button, { flex: 1 }]}><Text style={ui.buttonText}>{busy === request.id ? 'Saving…' : 'Accept'}</Text></Pressable>
          <Pressable disabled={!!busy} onPress={() => void reply(request.id, false)} style={[ui.button, ui.subtle, { flex: 1 }]}><Text style={[ui.buttonText, ui.subtleText]}>Decline</Text></Pressable>
        </View>}
      </View>;
    })}
    {!!error && <Text accessibilityLiveRegion="polite" style={ui.body}>{error}</Text>}
  </>;
}
