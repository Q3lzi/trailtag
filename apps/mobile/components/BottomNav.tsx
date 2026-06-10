import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Home, Mountain, BookOpen, User, Plus } from 'lucide-react-native';

const TABS = [
  { route: '/dashboard', label: 'Home', Icon: Home },
  { route: '/create-tour', label: 'Tour', Icon: Mountain, isCenter: true },
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

          if (tab.isCenter) {
            return (
              <TouchableOpacity
                key={tab.route}
                style={styles.centerTab}
                onPress={() => router.push(tab.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.centerBtn, isActive && styles.centerBtnActive]}>
                  <Plus size={26} color="#fff" strokeWidth={2.5} />
                </View>
                <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          }

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
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  centerTab: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    marginTop: -24,
  },
  iconWrapper: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperActive: {
    backgroundColor: '#f0faf4',
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#1a2e1a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a2e1a',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderWidth: 3,
    borderColor: '#f8faf8',
  },
  centerBtnActive: {
    backgroundColor: '#2D6A4F',
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