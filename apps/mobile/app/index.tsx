import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { getToken } from '../lib/storage';
import { apiFetch } from '../lib/api';
import { isBiometricEnabled, authenticateWithBiometric } from '../lib/biometric';
import { Platform } from 'react-native';

export default function HomeScreen() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAutoLogin();
  }, []);

  async function checkAutoLogin() {
    try {
      const token = await getToken();
      if (!token) { setChecking(false); return; }
      // Verify token is still valid
      await apiFetch('/auth/me', {}, token);

      // If biometric lock is enabled, require Face ID / Touch ID before entering
      if (Platform.OS !== 'web') {
        const bioEnabled = await isBiometricEnabled();
        if (bioEnabled) {
          const success = await authenticateWithBiometric('Trailtag entsperren');
          if (!success) { setChecking(false); return; }
        }
      }
      router.replace('/dashboard');
    } catch {
      // Token invalid/expired — show login screen
      setChecking(false);
    }
  }

  if (checking) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bg} />
      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Text style={styles.logoIcon}>🏔️</Text>
          <Text style={styles.logoTitle}>Trailtag</Text>
          <Text style={styles.logoSub}>Dein digitaler Sicherheitsbegleiter{'\n'}für alpine Abenteuer</Text>
        </View>
        <View style={styles.pills}>
          <View style={styles.pill}><Text style={styles.pillText}>🔔 SMS-Alarm</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>📍 GPS-Tracking</Text></View>
          <View style={styles.pill}><Text style={styles.pillText}>🚨 Erstretter-Portal</Text></View>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/login')}>
            <Text style={styles.btnPrimaryText}>Einloggen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/register')}>
            <Text style={styles.btnSecondaryText}>Konto erstellen</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.legal}>Für Bergsportler in der Schweiz 🇨🇭</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a2e1a' },
  bg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a2e1a' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 32 },
  logoSection: { alignItems: 'center', gap: 12 },
  logoIcon: { fontSize: 72 },
  logoTitle: { fontSize: 42, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  logoSub: { fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 24 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  buttons: { width: '100%', maxWidth: 320, gap: 12 },
  btnPrimary: { backgroundColor: '#4CAF7D', padding: 18, borderRadius: 16, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  btnSecondary: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnSecondaryText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  legal: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});
