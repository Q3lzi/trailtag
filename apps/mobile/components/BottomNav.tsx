import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';

const TABS = [
  { route: '/dashboard', label: 'Home', icon: '🏠' },
  { route: '/create-tour', label: 'Tour', icon: '🏔️' },
  { route: '/tours', label: 'Archiv', icon: '📋' },
  { route: '/profile', label: 'Profil', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = pathname === tab.route;
        return (
          <TouchableOpacity
            key={tab.route}
            style={styles.tab}
            onPress={() => router.push(tab.route as any)}
          >
            <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 22, opacity: 0.4 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: '#999', fontWeight: '600' },
  labelActive: { color: '#2D6A4F', fontWeight: '700' },
});