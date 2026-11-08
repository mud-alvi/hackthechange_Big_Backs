
import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function SectionScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();

  const [username, setUsername] = useState('Villager');
  const [email, setEmail] = useState('');
  const [xp, setXP] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data: { session } } =
        await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        router.replace('/');
        return;
      }

      setEmail(session.user.email || '');
      setUsername(session.user.user_metadata?.username || 'Villager');

      const { data } = await supabase
        .from('profiles')
        .select('username, total_xp')
        .eq('id', session.user.id)
        .maybeSingle();

      if (active && data) {
        setUsername(data.username);
        setXP(data.total_xp ?? 0);
      }
    }

    loadUser().catch(console.error);
    return () => { active = false; };
  }, [router]);

  const isProfile = type === 'profile';
  const isGames = type === 'games';

  const title = isProfile
    ? 'Your Profile'
    : isGames
      ? 'Village Games'
      : 'Coding Challenges';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/home')}
        >
          <Text style={styles.backText}>‹ Back to Village</Text>
        </Pressable>

        <Text style={styles.title}>{title}</Text>

        {isProfile ? (
          <>
            <View style={styles.profileCard}>
              <Image
                source={require('../../assets/images/base_avatar.png')}
                style={styles.avatar}
                resizeMode="contain"
              />

              <Text style={styles.username}>@{username}</Text>
              <Text style={styles.email}>{email}</Text>
              <Text style={styles.level}>
                Level {Math.floor(xp / 500) + 1}
              </Text>
              <Text style={styles.xp}>{xp} total XP</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>
                Your Social Village
              </Text>
              <Text style={styles.description}>
                Connections, mutual friends, endorsements and
                avatar customization will appear here.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>
              {isGames ? '🎮' : '💻'}
            </Text>

            <Text style={styles.cardTitle}>
              {isGames
                ? 'Play with your village!'
                : 'Challenge your coding skills!'}
            </Text>

            <Text style={styles.description}>
              {isGames
                ? 'Multiplayer games, shared quests, and rewards will be available here.'
                : 'Solve programming problems, complete challenges, and earn XP.'}
            </Text>

            <Text style={styles.comingSoon}>
              Coming Soon
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F2F8',
  },
  content: {
    padding: 24,
    paddingBottom: 50,
  },
  backButton: {
    paddingVertical: 10,
    marginBottom: 22,
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B8E87',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#30243C',
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: '#42314E',
    borderRadius: 28,
    padding: 25,
    alignItems: 'center',
  },
  avatar: {
    width: 195,
    height: 250,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 10,
  },
  email: {
    color: '#D9CCDF',
    marginTop: 6,
    fontSize: 14,
  },
  level: {
    color: '#A9E4D5',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 16,
  },
  xp: {
    color: '#E8E0EC',
    fontSize: 13,
    marginTop: 5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    marginTop: 20,
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 28,
    alignItems: 'center',
    marginTop: 20,
  },
  featureIcon: {
    fontSize: 58,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#30243C',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#82778C',
    textAlign: 'center',
    marginTop: 12,
  },
  comingSoon: {
    marginTop: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#EDE5F1',
    borderRadius: 15,
    color: '#785A8D',
    fontWeight: '700',
  },
});
