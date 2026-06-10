import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Home, Mountain, BookOpen, User } from 'lucide-react-native';

const TABS = [
  { route: '/dashboard', label: 'Home', Icon: Home },
  { route: '/create-tour', label: 'Tour', Icon: Mountain },
  { route: '/tours', label: 'Archiv', Icon: BookOpen },
  { route: '/profile', label: 'Profil', Icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.route;
          const { Icon } = tab;

          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tab}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
                <Icon
                  size={22}
                  color={isActive ? '#2D6A4F' : '#bbb'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#f8faf8',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#f0faf4',
  },
  label: {
    fontSize: 10,
    color: '#bbb',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#2D6A4F',
    fontWeight: '700',
  },
});