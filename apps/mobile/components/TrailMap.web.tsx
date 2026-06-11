import { View } from 'react-native';
import GpxMap from './GpxMap';

interface Props {
  points: { lat: number; lng: number; ele?: number }[];
}

export default function TrailMap({ points }: Props) {
  return <GpxMap points={points} />;
}