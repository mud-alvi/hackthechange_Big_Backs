/* eslint-disable @typescript-eslint/no-require-imports -- Native notification code must remain unloaded inside Expo Go and on web. */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../../../lib/supabase';

const available = () => Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
function notifications(): typeof import('expo-notifications') {
  if (!available()) throw new Error('Request notifications require a phone development build.');
  return require('expo-notifications');
}
export function listenForNotifications(onOpen: () => void) {
  if (!available()) return () => {};
  const module = notifications();
  module.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true,
    shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
  const subscription = module.addNotificationResponseReceivedListener(onOpen);
  const previous = module.getLastNotificationResponse();
  if (previous) { onOpen(); void module.clearLastNotificationResponseAsync(); }
  return () => subscription.remove();
}
export async function registerNotifications(requestPermission: boolean): Promise<string | null> {
  const module = notifications();
  if (!Device.isDevice) throw new Error('Use a physical phone to enable request notifications.');
  if (Platform.OS === 'android') await module.setNotificationChannelAsync('village-requests', {
    name: 'Village requests and messages', importance: module.AndroidImportance.HIGH, sound: 'default',
  });
  let permissions = await module.getPermissionsAsync();
  if (permissions.status !== 'granted' && requestPermission) permissions = await module.requestPermissionsAsync();
  if (permissions.status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('The app build has no Expo project ID.');
  const token = (await module.getExpoPushTokenAsync({ projectId })).data;
  const { error } = await supabase.rpc('village_register_device', { p_token: token, p_platform: Platform.OS });
  if (error) throw error;
  return token;
}
export async function unregisterNotifications(token: string) {
  const { error } = await supabase.rpc('village_unregister_device', { p_token: token });
  if (error) throw error;
}
