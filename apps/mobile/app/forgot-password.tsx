import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';
import { showAlert } from '../lib/alert';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRequestCode() {
    if (!email.trim()) { setError('E-Mail erforderlich'); return; }
    setError(''); setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setStep('reset');
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Senden');
    } finally { setLoading(false); }
  }

  async function handleResetPassword() {
    if (!code.trim() || !newPassword) { setError('Alle Felder erforderlich'); return; }
    if (newPassword !== confirmPassword) { setError('Passwörter stimmen nicht überein'); return; }
    if (newPassword.length < 8) { setError('Passwort muss mind. 8 Zeichen haben'); return; }
    setError(''); setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      showAlert('Passwort geändert ✓', 'Du kannst dich jetzt mit deinem neuen Passwort einloggen.');
      router.replace('/login');
    } catch (err: any) {
      setError(err.message ?? 'Fehler beim Zurücksetzen');
    } finally { setLoading(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.backBtn} onPress={() => step === 'reset' ? setStep('request') : router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Passwort vergessen</Text>
        <Text style={styles.sub}>
          {step === 'request'
            ? 'Gib deine E-Mail-Adresse ein, wir senden dir einen Code.'
            : `Code wurde an ${email} gesendet.`}
        </Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>
        ) : null}

        {step === 'request' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>E-Mail</Text>
              <TextInput
                style={styles.input}
                placeholder="deine@email.ch"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRequestCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Code anfordern</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Code (6-stellig)</Text>
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
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Neues Passwort</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Passwort bestätigen</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Passwort ändern</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRequestCode} style={{ alignSelf: 'center', marginTop: 8 }}>
              <Text style={{ color: '#2D6A4F', fontSize: 13, fontWeight: '600' }}>Code erneut senden</Text>
            </TouchableOpacity>
          </>
        )}
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
