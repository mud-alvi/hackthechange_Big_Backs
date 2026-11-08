
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type VillageProfile = {
  username: string;
  total_xp: number;
  user_code: string;
};

const sections = [
  {
    id: 'profile',
    icon: '👤',
    title: 'Profile',
    description: 'Avatar, connections, mutuals and achievements',
  },
  {
    id: 'games',
    icon: '🎮',
    title: 'Games',
    description: 'Play together and grow your village',
  },
  {
    id: 'coding',
    icon: '💻',
    title: 'Coding Challenges',
    description: 'Solve challenges and earn XP',
  },
];

export default function HomeScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<VillageProfile>({
    username: 'Villager',
    total_xp: 0,
    user_code: '', 
  });
  const [loading, setLoading] = useState(true);

  // Gentle floating animation for the avatar
  const floatY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -9,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1300,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [floatY]);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && active) {
          router.replace('/');
        }
      });

    async function loadProfile() {
      try {
        const { data: { session } } =
          await supabase.auth.getSession();

        if (!active) return;

        if (!session) {
          router.replace('/');
          return;
        }

        const fallbackName =
          session.user.user_metadata?.username ||
          'Villager';

        let username = fallbackName;
        let total_xp = 0;
        let user_code = '';

        const { data, error } = await supabase
          .from('profiles')
          .select('username, total_xp, user_code')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!active) return;

        if (!error && data) {
          username = data.username || fallbackName;
          total_xp = data.total_xp ?? 0;
          user_code = data.user_code ?? '';
        }

        setProfile({ username, total_xp, user_code });
      } catch (error) {
        console.log('Profile loading error:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Logout failed', error.message);
    } else {
      router.replace('/');
    }
  }

  const level = Math.floor(profile.total_xp / 500) + 1;
  const currentXP = profile.total_xp % 500;
  const xpProgress = (currentXP / 500) * 100;

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#76A6A0" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Brand header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>HackVillage</Text>
            <Text style={styles.tagline}>Find your people.</Text>
          </View>

          <Pressable onPress={handleLogout}>
            <Text style={styles.logout}>Log Out</Text>
          </Pressable>
        </View>

        {/* Welcome section */}
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>
            Welcome back, {profile.username}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Your next connection starts here.
          </Text>
        </View>

        {/* Avatar hero card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatarShadow} />

          <Animated.Image
            source={require('../../assets/images/base_avatar.png')}
            resizeMode="contain"
            style={[
              styles.avatar,
              { transform: [{ translateY: floatY }] },
            ]}
          />

          <Text style={styles.avatarUsername}>
            @{profile.username}
          </Text>

          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>
              Level {level}
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${xpProgress}%` },
              ]}
            />
          </View>

          <Text style={styles.xpText}>
            {currentXP} / 500 XP to next level
          </Text>
        </View>

        {/* Navigation */}
        <Text style={styles.sectionHeading}>
          Explore your village
        </Text>

        {sections.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.sectionCard,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.push({
                pathname: '/section',
                params: { type: item.id },
              })
            }
          >
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            <View style={styles.sectionInfo}>
              <Text style={styles.sectionTitle}>
                {item.title}
              </Text>
              <Text style={styles.sectionDescription}>
                {item.description}
              </Text>
            </View>

            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6F2F8',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F6F2F8',
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#76A6A0',
    paddingHorizontal: 25,
    paddingTop: 26,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#172C2A',
  },
  tagline: {
    color: '#34534E',
    fontSize: 13,
    marginTop: 4,
  },
  logout: {
    color: '#173B36',
    fontWeight: '700',
    fontSize: 13,
  },
  welcome: {
    paddingHorizontal: 25,
    paddingTop: 28,
    paddingBottom: 18,
  },
  welcomeTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#30243C',
  },
  welcomeSubtitle: {
    marginTop: 5,
    color: '#82758A',
    fontSize: 14,
  },
  avatarCard: {
    marginHorizontal: 22,
    backgroundColor: '#42314E',
    borderRadius: 30,
    height: 385,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 20,
    elevation: 7,
  },
  avatarGlow: {
    position: 'absolute',
    width: 285,
    height: 285,
    borderRadius: 145,
    top: 5,
    backgroundColor: 'rgba(190,146,206,0.22)',
  },
  avatarShadow: {
    position: 'absolute',
    top: 248,
    width: 145,
    height: 18,
    borderRadius: 100,
    backgroundColor: 'rgba(5,0,10,0.35)',
  },
  avatar: {
    width: 205,
    height: 260,
    marginTop: 6,
  },
  avatarUsername: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: -2,
  },
  levelBadge: {
    backgroundColor: '#836A94',
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 9,
  },
  levelText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  progressBar: {
    width: '75%',
    backgroundColor: '#695775',
    height: 8,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    backgroundColor: '#98D5C6',
    height: '100%',
    borderRadius: 10,
  },
  xpText: {
    color: '#E5DDEA',
    fontSize: 11,
    marginTop: 6,
  },
  sectionHeading: {
    marginHorizontal: 25,
    marginTop: 27,
    marginBottom: 13,
    fontSize: 19,
    fontWeight: '800',
    color: '#30243C',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 19,
    padding: 16,
    marginHorizontal: 22,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDE6F0',
  },
  pressed: {
    opacity: 0.7,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: '#EFE7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 26,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    color: '#30243C',
    fontWeight: '800',
  },
  sectionDescription: {
    color: '#82778C',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  arrow: {
    fontSize: 31,
    color: '#886C99',
  },
});
