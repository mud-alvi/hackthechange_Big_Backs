import {
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    useFonts,
} from '@expo-google-fonts/fredoka';

import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthCard } from '../components/intro/AuthCard';
import { IntroBackground } from '../components/intro/IntroBackground';
import { WavingMascot } from '../components/intro/WavingMascot';
import { useIntroAuth } from '../hooks/useIntroAuth';

import { INTRO_COLORS as C, INTRO_FONTS as F } from '../constants/introTheme';

export default function IntroScreen() {
  const auth = useIntroAuth();

  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });

  if (!fontsLoaded || auth.checkingSession || auth.session) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={C.violet} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <IntroBackground />

          {/* Branding */}
          <View style={styles.header}>
            <Text style={styles.brand}>HackVillage</Text>
            <Text style={styles.tagline}>Meet people. Make memories. ♡</Text>
          </View>

          {/* Login / Sign up */}
          <AuthCard auth={auth} />

          {/* Animated mascot */}
          <WavingMascot />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.background,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.background,
  },

  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 25,
    overflow: 'hidden',
  },

  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 22,
  },

  brand: {
    fontFamily: F.bold,
    fontSize: 43,
    color: C.violet,
    letterSpacing: -1.5,
  },

  tagline: {
    fontFamily: F.medium,
    fontSize: 15,
    color: C.pinkDark,
    marginTop: 3,
  },
});