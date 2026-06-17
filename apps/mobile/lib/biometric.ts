import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'trailtag-biometric-enabled';

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const LA = require('expo-local-authentication');
    const hasHardware = await LA.hasHardwareAsync();
    const isEnrolled = await LA.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function getBiometricType(): Promise<'face' | 'fingerprint' | null> {
  if (Platform.OS === 'web') return null;
  try {
    const LA = require('expo-local-authentication');
    const types = await LA.supportedAuthenticationTypesAsync();
    if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(LA.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    return null;
  } catch {
    return null;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const SecureStore = require('expo-secure-store');
    const val = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export async function authenticateWithBiometric(promptMessage: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const LA = require('expo-local-authentication');
    const result = await LA.authenticateAsync({
      promptMessage,
      cancelLabel: 'Abbrechen',
      disableDeviceFallback: false, // allow PIN/passcode fallback
    });
    return result.success;
  } catch {
    return false;
  }
}