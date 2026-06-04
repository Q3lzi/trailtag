import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { apiFetch } from '../lib/api';

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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    if (!name || !email || !password) { setError('Alle Felder sind Pflichtfelder.'); return; }
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }

    setLoading(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      router.replace('/login');
    } catch (err: any) {
      setError(err.message ?? 'Registrierung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '14px 16px', fontSize: 16,
    borderRadius: 12, border: '1.5px solid #e0e0e0',
    outline: 'none', backgroundColor: '#fafafa',
    fontFamily: 'inherit', color: '#222', boxSizing: 'border-box'
  } as any;

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Zurück</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Konto erstellen</Text>
        <Text style={styles.sub}>Kostenlos registrieren 🏔️</Text>
      </View>

      <View style={styles.form}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Name</Text>
          {Platform.OS === 'web' ? (
            <input type="text" placeholder="Max Muster" value={name} onChange={e => setName((e.target as any).value)} style={inputStyle} />
          ) : (
            <TextInput style={styles.input} placeholder="Max Muster" placeholderTextColor="#bbb" value={name} onChangeText={setName} />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>E-Mail</Text>
          {Platform.OS === 'web' ? (
            <input type="email" placeholder="deine@email.ch" value={email} onChange={e => setEmail((e.target as any).value)} style={inputStyle} />
          ) : (
            <TextInput style={styles.input} placeholder="deine@email.ch" placeholderTextColor="#bbb" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Passwort</Text>
          {Platform.OS === 'web' ? (
            <input type="password" placeholder="Min. 8 Zeichen" value={password} onChange={e => setPassword((e.target as any).value)} style={inputStyle} />
          ) : (
            <TextInput style={styles.input} placeholder="Min. 8 Zeichen" placeholderTextColor="#bbb" value={password} onChangeText={setPassword} secureTextEntry />
          )}
        </View>

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Erstelle Konto...' : 'Konto erstellen'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/login')}>
          <Text style={styles.switchText}>
            Bereits ein Konto? <Text style={styles.switchLink}>Einloggen</Text>
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