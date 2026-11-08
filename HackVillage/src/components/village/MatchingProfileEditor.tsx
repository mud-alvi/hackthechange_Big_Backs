import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ui, C } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';
import type { Interest } from '../../features/interests/types';
import { readSkills } from '../../features/skills/matcher';
import type { MatchingProfile } from '../../features/network/api';

const labels = (value: string) => value.split(/[,\n]/).map(text => text.trim()).filter(Boolean);
export function MatchingProfileEditor() {
  const { matchingProfile } = useVillage();
  if (!matchingProfile) return <Text style={ui.body}>Your matching profile will appear after account sync.</Text>;
  return <MatchingProfileForm key={matchingProfile.id} matchingProfile={matchingProfile} />;
}
function MatchingProfileForm({ matchingProfile }: { matchingProfile: MatchingProfile }) {
  const { normalizeLabels, saveMatchingProfile } = useVillage();
  const initial = matchingProfile.interests.map(interest => interest.label).join(', ');
  const [interests, setInterests] = useState(initial);
  const [have, setHave] = useState(matchingProfile.skills_have.join(', ')), [want, setWant] = useState(matchingProfile.skills_want.join(', ')), [need, setNeed] = useState(matchingProfile.skills_need.join(', '));
  const [share, setShare] = useState(matchingProfile.share_for_matching), [useAI, setUseAI] = useState(false);
  const [review, setReview] = useState<{ input: string; ai: boolean; tags: Interest[] } | null>({ input: initial, ai: false, tags: matchingProfile.interests });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function preview() {
    setBusy(true); setMessage('');
    try { setReview({ input: interests, ai: useAI, tags: await normalizeLabels(labels(interests), useAI) }); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not prepare interests.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!matchingProfile) return;
    setBusy(true); setMessage('');
    try {
      if (labels(interests).length && (!review || review.input !== interests || review.ai !== useAI)) throw new Error('Review your updated interests before saving.');
      await saveMatchingProfile({ ...matchingProfile, interests: labels(interests).length ? review!.tags : [],
        skills_have: readSkills(labels(have)), skills_want: readSkills(labels(want)), skills_need: readSkills(labels(need)), share_for_matching: share });
      setMessage('Your matching profile is saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your profile.'); }
    finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>Interests & skills</Text>
    <Text style={ui.body}>Separate entries with commas or new lines. You can enter up to 100 in each list.</Text>
    <Text style={ui.caption}>Interests</Text>
    <TextInput accessibilityLabel="Interests" editable={!busy} multiline style={ui.input} value={interests} onChangeText={setInterests} placeholder="Gaming, pottery, snowboarding" />
    <View style={ui.row}><Text style={[ui.body, { flex: 1 }]}>Use AI to group interest synonyms</Text><Switch accessibilityLabel="AI interest normalization" disabled={busy} value={useAI} onValueChange={setUseAI} /></View>
    <Text style={ui.caption}>{useAI ? 'Your interest labels are sent to OpenAI for grouping. Review the tags before saving.' : 'Exact-text matching: the same cleaned interest text matches. No AI request is made.'}</Text>
    <Pressable disabled={busy} onPress={() => void preview()} style={[ui.button, ui.subtle]}><Text style={[ui.buttonText, ui.subtleText]}>Review interests</Text></Pressable>
    {review?.input === interests && <View style={{ gap: 5 }}>{review.tags.map(tag => <Text key={tag.standard_id} style={ui.caption}>{tag.label} · {tag.category || 'exact text'}{tag.subcategory ? ' / ' + tag.subcategory : ''}</Text>)}</View>}
    {([['Skills I have', have, setHave], ['Skills I want to learn', want, setWant], ['Skills my project needs', need, setNeed]] as const).map(([label, value, change]) => <View key={label} style={{ gap: 5 }}>
      <Text style={ui.caption}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} multiline style={ui.input} value={value} onChangeText={change} placeholder="Python, React, design" />
    </View>)}
    <View style={ui.row}><Text style={[ui.body, { flex: 1 }]}>Share these interests and skills for matching</Text><Switch accessibilityLabel="Share interests and skills" disabled={busy} value={share} onValueChange={setShare} /></View>
    <Text style={ui.caption}>Self-search is controlled separately in Settings. Turning it off keeps manual IR encounters available.</Text>
    <Pressable disabled={busy} onPress={() => void save()} style={[ui.button, busy && { opacity: 0.5 }]}><Text style={ui.buttonText}>{busy ? 'Working…' : 'Save interests & skills'}</Text></Pressable>
    {!!message && <Text accessibilityLiveRegion="polite" style={[ui.body, { color: C.violet }]}>{message}</Text>}
  </View>;
}
