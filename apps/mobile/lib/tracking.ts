import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

// KRITISCH: Task muss auf Top-Level definiert sein — nicht lazy!
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  const SecureStore = require('expo-secure-store');

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
      console.log('Location sent:', latitude, longitude);
    } catch (err) {
      console.log('Location send error:', err);
    }
  });
}

export async function startLocationTracking(tourId: string) {
  if (Platform.OS === 'web') return;
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Background location permission denied — trying foreground only');
      // Fallback: Foreground only
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') return;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5 * 60 * 1000,      // alle 5 Minuten
      distanceInterval: 100,              // oder bei 100m Bewegung
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,  // iOS soll NICHT pausieren
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: '🏔️ Trailtag aktiv',
        notificationBody: 'Standort wird alle 5 Min. für Sicherheitsfunktion gesendet.',
        notificationColor: '#1a2e1a',
      },
    });

    console.log('Location tracking started for tour:', tourId);
  } catch (err) {
    console.log('Start tracking error:', err);
  }
}

export async function stopLocationTracking() {
  if (Platform.OS === 'web') return;
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.deleteItemAsync('trailtag-active-tour-id').catch(() => {});
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      console.log('Location tracking stopped');
    }
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}