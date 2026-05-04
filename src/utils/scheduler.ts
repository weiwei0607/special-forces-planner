import type { Spot, ItinerarySpot, Intensity } from '../db';
import { haversineKm, estimateTravelTimeMin, timeToMinutes, minutesToTime } from './geo';

export interface ScheduleResult {
  plan: ItinerarySpot[];
  totalWalkKm: number;
  totalTransitMin: number;
  totalCost: number;
  warnings: string[];
  feasible: boolean;
}

const INTENSITY_LIMITS: Record<Intensity, { maxSpots: number; maxWalkKm: number; maxActiveHours: number }> = {
  light: { maxSpots: 4, maxWalkKm: 5, maxActiveHours: 6 },
  medium: { maxSpots: 7, maxWalkKm: 10, maxActiveHours: 9 },
  hard: { maxSpots: 12, maxWalkKm: 20, maxActiveHours: 14 },
};

export function buildSchedule(
  spots: Spot[],
  startTime: string,
  endTime: string,
  transportMode: 'walk' | 'transit' | 'drive',
  intensity: Intensity,
  startLat?: number,
  startLng?: number
): ScheduleResult {
  if (spots.length === 0) {
    return { plan: [], totalWalkKm: 0, totalTransitMin: 0, totalCost: 0, warnings: [], feasible: true };
  }

  const limits = INTENSITY_LIMITS[intensity];
  const warnings: string[] = [];
  let totalWalkKm = 0;
  let totalTransitMin = 0;
  let totalCost = 0;

  // Greedy TSP: start from start point (or first spot), always pick nearest feasible spot
  const unvisited = new Set(spots.map((_s, i) => i));
  const order: number[] = [];
  let currentLat = startLat ?? spots[0].lat;
  let currentLng = startLng ?? spots[0].lng;

  while (unvisited.size > 0) {
    let bestIdx = -1;
    let bestScore = Infinity;

    for (const idx of unvisited) {
      const spotItem = spots[idx];
      const dist = haversineKm(currentLat, currentLng, spotItem.lat, spotItem.lng);
      const travelMin = estimateTravelTimeMin(dist, transportMode);
      // Score: prefer closer + cheaper
      const score = dist * 10 + spotItem.durationMin * 0.5 + travelMin;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;
    order.push(bestIdx);
    unvisited.delete(bestIdx);
    currentLat = spots[bestIdx].lat;
    currentLng = spots[bestIdx].lng;
  }

  // Build timeline
  const plan: ItinerarySpot[] = [];
  let currentTime = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  for (let i = 0; i < order.length; i++) {
    const idx = order[i];
    const spot = spots[idx];

    // Travel from previous
    let travelMin = 0;
    if (i === 0 && startLat !== undefined && startLng !== undefined) {
      const dist = haversineKm(startLat, startLng, spot.lat, spot.lng);
      travelMin = estimateTravelTimeMin(dist, transportMode);
    } else if (i > 0) {
      const prev = spots[order[i - 1]];
      const dist = haversineKm(prev.lat, prev.lng, spot.lat, spot.lng);
      travelMin = estimateTravelTimeMin(dist, transportMode);
    }

    const arrivalMin = currentTime + travelMin;
    const openMin = timeToMinutes(spot.openTime);
    const closeMin = timeToMinutes(spot.closeTime);

    let warning: string | undefined;
    if (arrivalMin > closeMin) {
      warning = '抵達時已閉館';
    } else if (arrivalMin < openMin) {
      // Wait until open
      currentTime = openMin;
    } else {
      currentTime = arrivalMin;
    }

    const departureMin = currentTime + spot.durationMin;

    if (departureMin > closeMin) {
      warning = warning ? `${warning}，停留時間不足` : '停留時間可能不足（接近閉館）';
    }

    if (endMin !== undefined && departureMin > endMin) {
      warning = warning ? `${warning}，超出預計結束時間` : '超出預計結束時間';
    }

    if (transportMode === 'walk') {
      const dist = i === 0 && startLat !== undefined && startLng !== undefined
        ? haversineKm(startLat, startLng, spot.lat, spot.lng)
        : i > 0 ? haversineKm(spots[order[i - 1]].lat, spots[order[i - 1]].lng, spot.lat, spot.lng) : 0;
      totalWalkKm += dist * 1.4;
    }
    totalTransitMin += travelMin;
    totalCost += spot.price;

    plan.push({
      spotId: spot.id,
      order: i,
      arrivalTime: minutesToTime(currentTime),
      departureTime: minutesToTime(departureMin),
      travelTimeFromPrev: travelMin,
      travelMode: transportMode,
      warning,
    });

    currentTime = departureMin;
  }

  // Check intensity limits
  const activeMin = currentTime - timeToMinutes(startTime);
  const activeHours = activeMin / 60;

  if (plan.length > limits.maxSpots) {
    warnings.push(`景點數（${plan.length}）超過「${intensity === 'light' ? '輕度' : intensity === 'medium' ? '中度' : '重度'}」模式建議上限（${limits.maxSpots}）`);
  }
  if (totalWalkKm > limits.maxWalkKm) {
    warnings.push(`總步行距離（${totalWalkKm.toFixed(1)} km）超過建議上限（${limits.maxWalkKm} km），建議改搭大眾運輸`);
  }
  if (activeHours > limits.maxActiveHours) {
    warnings.push(`總活動時間（${activeHours.toFixed(1)} 小時）過長，建議刪減景點`);
  }

  const feasible = plan.every(p => !p.warning);
  return { plan, totalWalkKm, totalTransitMin, totalCost, warnings, feasible };
}

export function recalculateFromDelay(
  it: { spots: Spot[]; plan: ItinerarySpot[]; endTime: string; transportMode: 'walk' | 'transit' | 'drive'; intensity: Intensity },
  completedCount: number,
  currentLat: number,
  currentLng: number,
  newStartTime: string,
): ScheduleResult {
  const remainingSpots = it.spots.filter((spotItem: Spot, _idx: number) => {
    const p = it.plan.find((planItem: ItinerarySpot) => planItem.spotId === spotItem.id);
    return p && p.order >= completedCount;
  });
  if (remainingSpots.length === 0) {
    return { plan: [], totalWalkKm: 0, totalTransitMin: 0, totalCost: 0, warnings: ['所有景點已完成'], feasible: true };
  }
  return buildSchedule(remainingSpots, newStartTime, it.endTime, it.transportMode, it.intensity, currentLat, currentLng);
}

export function suggestDropOrder(spots: Spot[], plan: ItinerarySpot[]): string[] {
  // Suggest which spots to drop if schedule is tight: longest duration + least unique tags first
  const scored = spots.map((spotItem) => {
    const p = plan.find(x => x.spotId === spotItem.id);
    const hasWarning = !!p?.warning;
    return {
      id: spotItem.id,
      name: spotItem.name,
      score: spotItem.durationMin * 2 + (hasWarning ? 1000 : 0) + spotItem.price * 0.1,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map(item => item.name);
}
