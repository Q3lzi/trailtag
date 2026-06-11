import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';
const SIGNIFICANT_TASK = 'trailtag-significant-task';

// Web Tracking
let webTrackingInterval: any = null;
let webActiveTourId: string | null = null;

// iOS Top-Level Task Registrierung
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  const SecureStore = require('expo-secure-store');

  // Standard Background Task
  if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
      if (error || !data) return;
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

  // Significant Location Changes Task (zuverlässiger auf iOS)
  if (!TaskManager.isTaskDefined(SIGNIFICANT_TASK)) {
    TaskManager.defineTask(SIGNIFICANT_TASK, async ({ data, error }: any) => {
      if (error || !data) return;
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
        console.log('📍 Significant location sent:', latitude, longitude);
      } catch (err) {
        console.log('Significant location send error:', err);
      }
    });
  }
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
    navigator.geolocation.getCurrentPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, tourId),
      (err) => console.log('Web geolocation error:', err),
      { enableHighAccuracy: true }
    );
    webTrackingInterval = setInterval(() => {
      if (!webActiveTourId) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, webActiveTourId!),
        (err) => console.log('Web geolocation error:', err),
        { enableHighAccuracy: true }
      );
    }, 3 * 60 * 1000);
    console.log('🌐 Web location tracking started');
    return;
  }

  // iOS/Android
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    // Background Permission anfordern
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();

    if (fgStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return;
    }

    // Bestehende Tasks stoppen
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    const isSignificantRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_TASK).catch(() => false);
    if (isSignificantRunning) await Location.stopLocationUpdatesAsync(SIGNIFICANT_TASK).catch(() => {});

    // Standard Background Task starten
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 3 * 60 * 1000,
      distanceInterval: 100,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.OtherNavigation,
      foregroundService: {
        notificationTitle: '🏔️ Trailtag aktiv',
        notificationBody: 'Standort-Tracking aktiv — bleib sicher!',
        notificationColor: '#1a2e1a',
      },
    });

    // Zusätzlich: Significant Location Changes (sehr zuverlässig auf iOS)
    if (bgStatus === 'granted') {
      await Location.startLocationUpdatesAsync(SIGNIFICANT_TASK, {
        accuracy: Location.Accuracy.Lowest,
        distanceInterval: 500, // Alle 500m
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
      });
      console.log('📱 Significant location tracking started');
    }

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
    return;
  }

  // iOS/Android
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.deleteItemAsync('trailtag-active-tour-id').catch(() => {});

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);

    const isSignificantRunning = await Location.hasStartedLocationUpdatesAsync(SIGNIFICANT_TASK).catch(() => false);
    if (isSignificantRunning) await Location.stopLocationUpdatesAsync(SIGNIFICANT_TASK);

    console.log('📱 iOS location tracking stopped');
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}