import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Trailtag' }} />
      <Stack.Screen name="login" options={{ title: 'Login' }} />
      <Stack.Screen name="register" options={{ title: 'Registrieren' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="create-tour" options={{ title: 'Tour starten' }} />
      <Stack.Screen name="vehicle" options={{ title: 'Fahrzeug' }} />
    </Stack>
  );
}