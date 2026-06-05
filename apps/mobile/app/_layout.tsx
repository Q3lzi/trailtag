import { Stack } from 'expo-router';

console.log('LAYOUT LOADING');

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}