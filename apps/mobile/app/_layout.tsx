import { Stack, useSegments } from 'expo-router';
import { View } from 'react-native';
import { useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { registerForPushNotifications } from '../lib/notifications';
import '../lib/tracking'; // Task auf Top-Level registrieren

function Layout() {
  const segments = useSegments();
  const firstSegment = segments[0] ?? '';
  const hideNav = ['', 'login', 'register'].includes(firstSegment);

  useEffect(() => {
    (async () => {
      const token = await registerForPushNotifications();
      if (token) {
        // Save push token to backend
        try {
          const { getToken: getAuthToken } = await import('../lib/storage');
          const { apiFetch } = await import('../lib/api');
          const authToken = await getAuthToken();
          if (authToken) {
            await apiFetch('/profile/push-token', {
              method: 'POST',
              body: JSON.stringify({ token }),
            }, authToken);
          }
        } catch { /* ignore */ }
      }
    })();
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
        <Stack.Screen name="tour-detail" />
      </Stack>
      {!hideNav && <BottomNav />}
    </View>
  );
}

export default function RootLayout() {
  return <Layout />;
}