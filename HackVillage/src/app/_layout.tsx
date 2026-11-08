import {
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    useFonts,
} from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VillageProvider } from '../state/VillageProvider';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  if (!loaded && !error)
    return (
      <View
        style={{ flex: 1, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color="#6952E8" />
      </View>
    );
  if (error)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text>Fonts could not load. Restart the app to try again.</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <VillageProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#FFF' },
            animation: 'fade',
          }}
        />
      </VillageProvider>
    </SafeAreaProvider>
  );
}