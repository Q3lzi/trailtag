import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';
const TOUR_ID_KEY = 'trailtag-active-tour-id';

// Task Definition — muss auf Top-Level stehen
if (Platform.OS !== 'web') {
  TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
    if (error) { console.log('Location task error:', error); return; }
    if (!data) return;
    const { locations } = data;
    if (!locations?.length) return;
    const { latitude, longitude, altitude } = locations[0].coords;
    try {
      const token = await getToken();
      if (!token) return;
      // Tour ID aus Storage lesen
      const { getItemAsync } = await import('expo-secure-store');
      const tourId = await getItemAsync(TOUR_ID_KEY);
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

export async function startLocationTracking(tourId: string) {
  if (Platform.OS === 'web') return;
  try {
    // Tour ID speichern damit der Background Task sie kennt
    const { setItemAsync } = await import('expo-secure-store');
    await setItemAsync(TOUR_ID_KEY, tourId);

    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Background location permission denied');
      return;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (!isRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000, // alle 5 Minuten
        distanceInterval: 50, // oder bei 50m Bewegung
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
    const { deleteItemAsync } = await import('expo-secure-store');
    await deleteItemAsync(TOUR_ID_KEY).catch(() => {});
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}