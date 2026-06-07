import { Stack, useSegments } from 'expo-router';
import { View } from 'react-native';
import { useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { registerForPushNotifications } from '../lib/notifications';

function Layout() {
  const segments = useSegments();
  const firstSegment = segments[0] ?? '';
  const hideNav = ['', 'login', 'register'].includes(firstSegment);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="create-tour" />
        <Stack.Screen name="tours" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="vehicle" />
      </Stack>
      {!hideNav && <BottomNav />}
    </View>
  );
}

export default function RootLayout() {
  return <Layout />;
}