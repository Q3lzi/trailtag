import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';

const TABS = [
  { route: '/dashboard', label: 'Home', icon: '🏠' },
  { route: '/create-tour', label: 'Tour starten', icon: '🏔️' },
  { route: '/tours', label: 'Archiv', icon: '📋' },
  { route: '/profile', label: 'Profil', icon: '👤' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {TABS.map((tab, index) => {
          const isActive = pathname === tab.route;
          const isCenter = index === 1; // Tour starten — prominent

          return (
            <TouchableOpacity
              key={tab.route}
              style={[styles.tab, isCenter && styles.tabCenter]}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.7}
            >
              {isCenter ? (
                <View style={[styles.centerBtn, isActive && styles.centerBtnActive]}>
                  <Text style={styles.centerIcon}>{tab.icon}</Text>
                </View>
              ) : (
                <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
                  <Text style={[styles.icon, isActive && styles.iconActive]}>{tab.icon}</Text>
                </View>
              )}
              <Text style={[
                styles.label,
                isActive && styles.labelActive,
                isCenter && styles.labelCenter,
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 8,
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tabCenter: {
    flex: 1.2,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapperActive: {
    backgroundColor: '#f0faf4',
  },
  icon: {
    fontSize: 22,
    opacity: 0.35,
  },
  iconActive: {
    opacity: 1,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a2e1a',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  centerBtnActive: {
    backgroundColor: '#1a2e1a',
  },
  centerIcon: {
    fontSize: 24,
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
  labelCenter: {
    fontSize: 10,
    color: '#888',
  },
});