import MapView, { Polyline, Marker } from 'react-native-maps';
import { View, StyleSheet } from 'react-native';

interface Props {
  points: { lat: number; lng: number; ele?: number }[];
}

export default function TrailMap({ points }: Props) {
  if (!points || points.length === 0) return null;

  const coords = points.map(p => ({ latitude: p.lat, longitude: p.lng }));
  const first = coords[0];
  const last = coords[coords.length - 1];

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const region = {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
    latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.3 + 0.01,
    longitudeDelta: (Math.max(...lngs) - Math.min(...lngs)) * 1.3 + 0.01,
  };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} mapType="terrain">
        {coords.length > 1 && (
          <Polyline coordinates={coords} strokeColor="#2D6A4F" strokeWidth={3} />
        )}
        <Marker coordinate={first} pinColor="#2D6A4F" title="Start" />
        {coords.length > 1 && (
          <Marker coordinate={last} pinColor="#e63946" title="Letzter Standort" />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  map: { flex: 1 },
});