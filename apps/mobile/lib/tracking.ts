import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

// Web: Interval ID für watchPosition
let webTrackingInterval: any = null;
let webActiveTourId: string | null = null;

// iOS/Android: Task auf Top-Level registrieren
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
      console.log('📍 Background location sent:', latitude, longitude);
    } catch (err) {
      console.log('Location send error:', err);
    }
  });
}

async function sendLocation(lat: number, lng: number, ele: number | null, tourId: string) {
  try {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/tours/${tourId}/location`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, ele }),
    }, token);
    console.log('📍 Location sent:', lat, lng);
  } catch (err) {
    console.log('Send location error:', err);
  }
}

export async function startLocationTracking(tourId: string) {
  // WEB
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) return;
    webActiveTourId = tourId;

    // Sofort einmal senden
    navigator.geolocation.getCurrentPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, tourId),
      (err) => console.log('Web geolocation error:', err),
      { enableHighAccuracy: true }
    );

    // Dann alle 3 Minuten
    webTrackingInterval = setInterval(() => {
      if (!webActiveTourId) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, webActiveTourId!),
        (err) => console.log('Web geolocation error:', err),
        { enableHighAccuracy: true }
      );
    }, 30 * 1000);

    console.log('🌐 Web location tracking started');
    return;
  }

  // iOS/Android
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Background location permission denied — trying foreground only');
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') return;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 30 * 1000,
      distanceInterval: 50,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.OtherNavigation,
      deferredUpdatesInterval: 60 * 1000,
      deferredUpdatesDistance: 50,
      foregroundService: {
        notificationTitle: '🏔️ Trailtag aktiv',
        notificationBody: 'Standort-Tracking aktiv — bleib sicher!',
        notificationColor: '#1a2e1a',
      },
    });

    console.log('📱 iOS location tracking started for tour:', tourId);
  } catch (err) {
    console.log('Start tracking error:', err);
  }
}

export async function stopLocationTracking() {
  // Web
  if (Platform.OS === 'web') {
    if (webTrackingInterval) {
      clearInterval(webTrackingInterval);
      webTrackingInterval = null;
    }
    webActiveTourId = null;
    console.log('🌐 Web location tracking stopped');
    return;
  }

  // iOS/Android
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.deleteItemAsync('trailtag-active-tour-id').catch(() => {});
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      console.log('📱 iOS location tracking stopped');
    }
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}