import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../lib/api';

// Autofill CSS fix — nur im Web
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0px 1000px #fafafa inset !important;
      -webkit-text-fill-color: #222 !important;
      transition: background-color 5000s ease-in-out 0s;
    }
  `;
  document.head.appendChild(style);
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (Platform.OS === 'web') localStorage.setItem('token', data.token);
      else await SecureStore.setItemAsync('token', data.token);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Top Section */}
      <View style={styles.top}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Einloggen</Text>
        <Text style={styles.sub}>Schön dich wieder zu sehen 👋</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>E-Mail</Text>
          {Platform.OS === 'web' ? (
            <input
              type="email"
              placeholder="deine@email.ch"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 16,
                borderRadius: 12, border: '1.5px solid #e0e0e0',
                outline: 'none', backgroundColor: '#fafafa',
                fontFamily: 'inherit', color: '#222', boxSizing: 'border-box'
              } as any}
            />
          ) : (
            <TextInput style={styles.input} placeholder="deine@email.ch" placeholderTextColor="#bbb" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Passwort</Text>
          {Platform.OS === 'web' ? (
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 16,
                borderRadius: 12, border: '1.5px solid #e0e0e0',
                outline: 'none', backgroundColor: '#fafafa',
                fontFamily: 'inherit', color: '#222', boxSizing: 'border-box'
              } as any}
            />
          ) : (
            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor="#bbb" value={password} onChangeText={setPassword} secureTextEntry />
          )}
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Anmelden...' : 'Einloggen'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.switchText}>
            Noch kein Konto? <Text style={styles.switchLink}>Registrieren</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  top: { paddingTop: 60, paddingHorizontal: 28, paddingBottom: 32, backgroundColor: '#fff' },
  backBtn: { marginBottom: 24 },
  backText: { color: '#2D6A4F', fontSize: 15, fontWeight: '600' },
  title: { fontSize: 34, fontWeight: '800', color: '#111', marginBottom: 8, letterSpacing: -0.5 },
  sub: { fontSize: 16, color: '#888' },
  form: { flex: 1, paddingHorizontal: 28, paddingTop: 8, gap: 20 },
  errorBox: { backgroundColor: '#fff5f5', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fed7d7' },
  errorText: { color: '#c53030', fontSize: 14 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#555', letterSpacing: 0.3 },
  input: { backgroundColor: '#fafafa', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1.5, borderColor: '#e0e0e0', color: '#222' },
  btn: { backgroundColor: '#2D6A4F', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  switchText: { textAlign: 'center', color: '#999', fontSize: 14 },
  switchLink: { color: '#2D6A4F', fontWeight: '700' },
});