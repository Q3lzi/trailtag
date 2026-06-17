import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { getToken } from '../lib/storage';
import { showAlert } from '../lib/alert';

export default function VerifyEmailScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify() {
    if (!code.trim()) { setError('Code erforderlich'); return; }
    setError(''); setLoading(true);
    try {
      const token = await getToken();
      await apiFetch('/auth/verify-email', { method: 'POST', body: JSON.stringify({ code: code.trim() }) }, token ?? undefined);
      showAlert('E-Mail bestätigt ✓', 'Danke! Deine E-Mail-Adresse wurde bestätigt.');
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Ungültiger Code');
    } finally { setLoading(false); }
  }

  async function handleResend() {
    setResending(true);
    try {
      const token = await getToken();
      await apiFetch('/auth/resend-verification', { method: 'POST' }, token ?? undefined);
      showAlert('Code gesendet', 'Ein neuer Code wurde an deine E-Mail gesendet.');
    } catch (err: any) {
      showAlert('Fehler', err.message);
    } finally { setResending(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/dashboard')}>
          <Text style={styles.backText}>← Später</Text>
        </TouchableOpacity>
        <Text style={styles.title}>E-Mail bestätigen</Text>
        <Text style={styles.sub}>Wir haben dir einen 6-stelligen Code gesendet. Gib ihn unten ein.</Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Code</Text>
          <TextInput
            style={[styles.input, { fontSize: 24, letterSpacing: 8, textAlign: 'center' }]}
            placeholder="000000"
            placeholderTextColor="#bbb"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Bestätigen</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={resending} style={{ alignSelf: 'center', marginTop: 8 }}>
          <Text style={{ color: '#2D6A4F', fontSize: 13, fontWeight: '600' }}>
            {resending ? 'Sende...' : 'Code erneut senden'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  top: { paddingTop: 60, paddingHorizontal: 28, paddingBottom: 32 },
  backBtn: { marginBottom: 24 },
  backText: { color: '#2D6A4F', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800', color: '#111', marginBottom: 8, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: '#888', lineHeight: 21 },
  form: { flex: 1, paddingHorizontal: 28, paddingTop: 8, gap: 20 },
  errorBox: { backgroundColor: '#fff5f5', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fed7d7' },
  errorText: { color: '#c53030', fontSize: 14 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#555', letterSpacing: 0.3 },
  input: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1.5, borderColor: '#e0e0e0', color: '#222' },
  btn: { backgroundColor: '#2D6A4F', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
