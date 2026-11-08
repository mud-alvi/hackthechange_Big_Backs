import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, ui } from '../../constants/villageTheme';
import { useVillage } from '../../state/VillageProvider';

export function ScreenGate({ children }: { children: ReactNode }) {
  const { authReady, ready, session } = useVillage();
  if (!authReady) return <Loading />;
  if (!session) return <Redirect href="/" />;
  if (!ready) return <Loading />;
  return <>{children}</>;
}
function Loading() {
  return (
    <SafeAreaView style={[ui.screen, { justifyContent: 'center' }]}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <ActivityIndicator color={C.violet} size="large" />
        <Text style={ui.body}>Opening your village…</Text>
      </View>
    </SafeAreaView>
  );
}
