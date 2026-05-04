export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function estimateTravelTimeMin(
  distanceKm: number,
  mode: 'walk' | 'transit' | 'drive'
): number {
  // Apply a road factor (real routes are ~1.4x longer than straight line)
  const roadDistance = distanceKm * 1.4;
  switch (mode) {
    case 'walk':
      return Math.round((roadDistance / 5) * 60); // 5 km/h
    case 'transit':
      return Math.round((roadDistance / 20) * 60 + 10); // 20 km/h + 10 min wait
    case 'drive':
      return Math.round((roadDistance / 30) * 60 + 8); // 30 km/h + 8 min parking
  }
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addMinutes(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}
