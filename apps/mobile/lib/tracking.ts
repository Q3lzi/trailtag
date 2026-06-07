import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

async function setupTask() {
  if (Platform.OS === 'web') return;
  const TaskManager = await import('expo-task-manager');
  const Location = await import('expo-location');
  const SecureStore = await import('expo-secure-store');

  if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
      if (error) { console.log('Location task error:', error); return; }
      if (!data) return;
      const { locations } = data;
      if (!locations?.length) return;
      const { latitude, longitude, altitude } = locations[0].coords;
      try {
        const token = await getToken();
        if (!token) return;
        const tourId = await SecureStore.getItemAsync('trailtag-active-tour-id');
        if (!tourId) return;
        await apiFetch(`/tours/${tourId}/location`, {
          method: 'POST',
          body: JSON.stringify({ lat: latitude, lng: longitude, ele: altitude }),
        }, token);
      } catch (err) {
        console.log('Location send error:', err);
      }
    });
  }
}

export async function startLocationTracking(tourId: string) {
  if (Platform.OS === 'web') return;
  try {
    await setupTask();
    const SecureStore = await import('expo-secure-store');
    const Location = await import('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Background location permission denied');
      return;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!isRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000,
        distanceInterval: 50,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: '🏔️ Trailtag aktiv',
          notificationBody: 'Dein Standort wird für die Sicherheitsfunktion gesendet.',
          notificationColor: '#1a2e1a',
        },
      });
    }
  } catch (err) {
    console.log('Start tracking error:', err);
  }
}

export async function stopLocationTracking() {
  if (Platform.OS === 'web') return;
  try {
    const SecureStore = await import('expo-secure-store');
    const Location = await import('expo-location');

    await SecureStore.deleteItemAsync('trailtag-active-tour-id').catch(() => {});
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}