import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏔️ Trailtag</Text>
      <Text style={styles.subtitle}>Sicher unterwegs in den Bergen</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/login')}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonOutline} onPress={() => router.push('/register')}>
        <Text style={styles.buttonOutlineText}>Registrieren</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 48 },
  button: { backgroundColor: '#2D6A4F', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  buttonOutline: { borderWidth: 2, borderColor: '#2D6A4F', padding: 16, borderRadius: 12, width: '100%', alignItems: 'center' },
  buttonOutlineText: { color: '#2D6A4F', fontWeight: 'bold', fontSize: 16 },
});