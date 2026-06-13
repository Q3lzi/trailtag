import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

// Web Tracking
let webTrackingInterval: any = null;
let webActiveTourId: string | null = null;

// iOS/Android Top-Level Task
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  const SecureStore = require('expo-secure-store');

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
        console.log('📍 Location sent:', latitude, longitude);
      } catch (err) {
        console.log('Location send error:', err);
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
    return;
  }

  // iOS/Android
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    // Permissions
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') { console.log('Foreground permission denied'); return; }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    // Bestehende Tasks stoppen
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    if (bgStatus === 'granted') {
      // Sofort einmal senden
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await sendLocation(current.coords.latitude, current.coords.longitude, current.coords.altitude, tourId);

      // Background Task mit optimalen iOS Einstellungen
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5 * 60 * 1000,        // alle 5 Minuten
        distanceInterval: 50,                 // oder alle 50m
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness, // Fitness ist zuverlässiger als OtherNavigation
        deferredUpdatesInterval: 5 * 60 * 1000,
        deferredUpdatesDistance: 50,
        foregroundService: {
          notificationTitle: '🏔️ Trailtag aktiv',
          notificationBody: 'Safety-Timer läuft — Standort wird getrackt',
          notificationColor: '#1a2e1a',
        },
      });
      console.log('📱 Background tracking started');
    } else {
      console.log('⚠️ Background permission not granted — only foreground tracking');
    }
  } catch (err) {
    console.log('Start tracking error:', err);
  }
}

export async function stopLocationTracking() {
  if (Platform.OS === 'web') {
    if (webTrackingInterval) { clearInterval(webTrackingInterval); webTrackingInterval = null; }
    webActiveTourId = null;
    return;
  }
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');
    await SecureStore.deleteItemAsync('trailtag-active-tour-id').catch(() => {});
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    console.log('📱 Tracking stopped');
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}