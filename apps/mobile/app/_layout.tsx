import { Stack } from 'expo-router';
import { View } from 'react-native';
import { usePathname } from 'expo-router';
import BottomNav from '../components/BottomNav';

const HIDE_NAV = ['/', '/login', '/register'];

export default function RootLayout() {
  const pathname = usePathname();
  const showNav = !HIDE_NAV.includes(pathname);

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
      {showNav && <BottomNav />}
    </View>
  );
}