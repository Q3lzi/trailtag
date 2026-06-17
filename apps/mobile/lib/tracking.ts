import { Platform } from 'react-native';
import { getToken } from './storage';
import { apiFetch } from './api';

const LOCATION_TASK = 'trailtag-location-task';

// ── Tracking Settings (loaded from user prefs) ────────────────────────────────
export type TrackingMode = 'precise' | 'balanced' | 'battery';

export const TRACKING_MODES: Record<TrackingMode, {
  label: string;
  sub: string;
  accuracy: number;        // expo-location Accuracy enum value
  distanceInterval: number; // meters
  timeInterval: number;    // ms
}> = {
  precise: {
    label: 'Präzise',
    sub: 'GPS max. Genauigkeit · ~3–5m · Akku ↓↓',
    accuracy: 6,           // Location.Accuracy.BestForNavigation
    distanceInterval: 5,   // every 5m
    timeInterval: 15000,   // every 15s
  },
  balanced: {
    label: 'Ausgewogen',
    sub: 'GPS gut · ~10–30m · Akku ↓',
    accuracy: 4,           // Location.Accuracy.High
    distanceInterval: 20,  // every 20m
    timeInterval: 30000,   // every 30s
  },
  battery: {
    label: 'Akkuschonend',
    sub: 'GPS reduziert · ~50–100m · Akku ↔',
    accuracy: 3,           // Location.Accuracy.Balanced
    distanceInterval: 50,  // every 50m
    timeInterval: 120000,  // every 2min
  },
};

const DEFAULT_MODE: TrackingMode = 'balanced';

// Read tracking mode from SecureStore
async function getTrackingMode(): Promise<TrackingMode> {
  try {
    if (Platform.OS === 'web') return DEFAULT_MODE;
    const SecureStore = require('expo-secure-store');
    const mode = await SecureStore.getItemAsync('trailtag-tracking-mode');
    if (mode && mode in TRACKING_MODES) return mode as TrackingMode;
  } catch {}
  return DEFAULT_MODE;
}

export async function setTrackingMode(mode: TrackingMode) {
  try {
    if (Platform.OS === 'web') return;
    const SecureStore = require('expo-secure-store');
    await SecureStore.setItemAsync('trailtag-tracking-mode', mode);
  } catch {}
}

// ── Web tracking ──────────────────────────────────────────────────────────────
let webWatchId: number | null = null;
let webActiveTourId: string | null = null;
let webLastSent = 0;
let lastWebLat: number | null = null;
let lastWebLng: number | null = null;

// ── Background Task ───────────────────────────────────────────────────────────
if (Platform.OS !== 'web') {
  const TaskManager = require('expo-task-manager');
  const SecureStore = require('expo-secure-store');

  if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
    TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
      if (error || !data?.locations?.length) return;
      const { latitude, longitude, altitude, accuracy } = data.locations[0].coords;
      // Skip if accuracy is terrible (>200m)
      if (accuracy > 200) {
        console.log(`📍 Skipped inaccurate point: ±${Math.round(accuracy)}m`);
        return;
      }
      try {
        const token = await getToken();
        if (!token) return;
        const tourId = await SecureStore.getItemAsync('trailtag-active-tour-id');
        if (!tourId) return;
        await apiFetch(`/tours/${tourId}/location`, {
          method: 'POST',
          body: JSON.stringify({ lat: latitude, lng: longitude, ele: altitude, accuracy }),
        }, token);
        console.log(`📍 Sent: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} ±${Math.round(accuracy)}m`);
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

async function sendLocation(lat: number, lng: number, ele: number | null, tourId: string, accuracy?: number | null) {
  try {
    const token = await getToken();
    if (!token) return;
    await apiFetch(`/tours/${tourId}/location`, {
      method: 'POST',
      body: JSON.stringify({ lat, lng, ele, accuracy }),
    }, token);
  } catch (err) {
    console.log('Send location error:', err);
  }
}

export async function startLocationTracking(tourId: string) {
  // ── WEB ──────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) return;
    if (webWatchId !== null) navigator.geolocation.clearWatch(webWatchId);
    webActiveTourId = tourId;
    lastWebLat = null; lastWebLng = null; webLastSent = 0;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.altitude, tourId, pos.coords.accuracy);
        lastWebLat = pos.coords.latitude; lastWebLng = pos.coords.longitude;
        webLastSent = Date.now();
      },
      (err) => console.log('Web geolocation error:', err),
      { enableHighAccuracy: true }
    );

    webWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!webActiveTourId) return;
        const { latitude, longitude, altitude } = pos.coords;
        const now = Date.now();
        const timePassed = now - webLastSent > 30000;
        const moved = lastWebLat === null || calcDistance(lastWebLat, lastWebLng!, latitude, longitude) >= 10;
        if (timePassed || moved) {
          sendLocation(latitude, longitude, altitude, webActiveTourId, pos.coords.accuracy);
          lastWebLat = latitude; lastWebLng = longitude; webLastSent = now;
        }
      },
      (err) => console.log('Web watch error:', err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return;
  }

  // ── iOS/Android ──────────────────────────────────────────────────────────────
  try {
    const SecureStore = require('expo-secure-store');
    const Location = require('expo-location');

    const mode = await getTrackingMode();
    const settings = TRACKING_MODES[mode];

    await SecureStore.setItemAsync('trailtag-active-tour-id', tourId);

    // Request permissions
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') { console.log('Foreground permission denied'); return; }
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();

    // Stop existing task
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});

    // Send immediate high-accuracy fix first
    console.log('📍 Getting initial position...');
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,  // always high for initial fix
    });
    await sendLocation(
      current.coords.latitude,
      current.coords.longitude,
      current.coords.altitude,
      tourId,
      current.coords.accuracy
    );
    console.log(`📍 Initial fix: ${current.coords.latitude.toFixed(5)}, ${current.coords.longitude.toFixed(5)} ±${Math.round(current.coords.accuracy)}m`);

    // Start background updates with user-chosen mode
    const taskOptions: any = {
      accuracy: settings.accuracy,
      timeInterval: settings.timeInterval,
      distanceInterval: settings.distanceInterval,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,           // never pause
      activityType: Location.ActivityType.Other,   // "Other" is most permissive on iOS
      deferredUpdatesInterval: settings.timeInterval,
      deferredUpdatesDistance: settings.distanceInterval,
    };

    if (bgStatus === 'granted') {
      taskOptions.foregroundService = {
        notificationTitle: '🏔 Trailtag — Tour aktiv',
        notificationBody: `GPS-Tracking (${settings.label}) läuft`,
        notificationColor: '#1a2e1a',
      };
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK, taskOptions);
    console.log(`📱 Tracking gestartet: ${settings.label} (${settings.distanceInterval}m / ${settings.timeInterval/1000}s)`);

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
    console.log('📱 Tracking gestoppt');
  } catch (err) {
    console.log('Stop tracking error:', err);
  }
}