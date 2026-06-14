import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

// Web: use watchPosition for continuous tracking
let webWatchId: number | null = null;
let webActiveTourId: string | null = null;
let webLastSent = 0;
const WEB_MIN_INTERVAL = 30 * 1000; // min 30s between sends
const WEB_MIN_DISTANCE = 10; // min 10m movement

let lastWebLat: number | null = null;
let lastWebLng: number | null = null;

// iOS/Android Top-Level Background Task
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  const SecureStore = require('expo-secure-store');

  if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
      if (error || !data?.locations?.length) return;
      const { latitude, longitude, altitude } = data.locations[0].coords;
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
}

function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
  // ── WEB ──
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) return;
    // Stop existing watch
    if (webWatchId !== null) navigator.geolocation.clearWatch(webWatchId);
    webActiveTourId = tourId;
    lastWebLat = null; lastWebLng = null; webLastSent = 0;

    // Send immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, tourId);
        lastWebLat = pos.coords.latitude; lastWebLng = pos.coords.longitude;
        webLastSent = Date.now();
      },
      (err) => console.log('Web geolocation error:', err),
      { enableHighAccuracy: true }
    );

    // Continuous watch — send when moved ≥10m OR ≥30s passed
    webWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!webActiveTourId) return;
        const { latitude, longitude, altitude } = pos.coords;
        const now = Date.now();
        const timePassed = now - webLastSent > WEB_MIN_INTERVAL;
        const moved = lastWebLat === null || calcDistance(lastWebLat, lastWebLng!, latitude, longitude) >= WEB_MIN_DISTANCE;
        if (timePassed || moved) {
          sendLocation(latitude, longitude, altitude, webActiveTourId);
          lastWebLat = latitude; lastWebLng = longitude; webLastSent = now;
        }
      },
      (err) => console.log('Web watch error:', err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return;
  }

  // ── iOS/Android ──
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') { console.log('Foreground permission denied'); return; }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    // Stop existing task
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    // Send current position immediately
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    await sendLocation(current.coords.latitude, current.coords.longitude, current.coords.altitude, tourId);

    if (bgStatus === 'granted') {
      // Continuous background tracking — every 10m or 60s
      // distanceInterval=10m captures the full path for rescue
      // timeInterval=60s as fallback when stationary
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,       // good accuracy, not max (saves battery)
        timeInterval: 60 * 1000,                    // at least every 60s
        distanceInterval: 10,                        // every 10m of movement → full trail
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        foregroundService: {
          notificationTitle: '🏔️ Trailtag aktiv',
          notificationBody: 'Safety-Timer läuft — Standort wird getrackt',
          notificationColor: '#1a2e1a',
        },
      });
      console.log('📱 Continuous background tracking started (10m / 60s)');
    } else {
      // Foreground only — still better than nothing
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60 * 1000,
        distanceInterval: 10,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
      });
      console.log('⚠️ Foreground-only tracking (10m / 60s)');
    }
  } catch (err) {
    console.log('Start tracking error:', err);
  }
}

export async function stopLocationTracking() {
  if (Platform.OS === 'web') {
    if (webWatchId !== null) { navigator.geolocation.clearWatch(webWatchId); webWatchId = null; }
    webActiveTourId = null; lastWebLat = null; lastWebLng = null;
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