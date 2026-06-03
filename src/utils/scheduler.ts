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

function routeDistance(order: number[], spots: Spot[], startLat?: number, startLng?: number): number {
  let dist = 0;
  let lat = startLat ?? spots[order[0]]?.lat ?? 0;
  let lng = startLng ?? spots[order[0]]?.lng ?? 0;
  for (const idx of order) {
    dist += haversineKm(lat, lng, spots[idx].lat, spots[idx].lng);
    lat = spots[idx].lat;
    lng = spots[idx].lng;
  }
  return dist;
}

function twoOpt(
  spots: Spot[],
  initialOrder: number[],
  startLat?: number,
  startLng?: number
): number[] {
  let order = [...initialOrder];
  let improved = true;
  let iterations = 0;
  const maxIterations = 500;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const newOrder = [...order];
        // Reverse segment [i, j]
        const segment = newOrder.slice(i, j + 1).reverse();
        newOrder.splice(i, segment.length, ...segment);

        const oldDist = routeDistance(order, spots, startLat, startLng);
        const newDist = routeDistance(newOrder, spots, startLat, startLng);

        if (newDist < oldDist - 0.001) {
          order = newOrder;
          improved = true;
        }
      }
    }
  }
  return order;
}

function buildNearestNeighborOrder(
  spots: Spot[],
  startLat?: number,
  startLng?: number
): number[] {
  const unvisited = new Set(spots.map((_s, i) => i));
  const order: number[] = [];
  let currentLat = startLat ?? spots[0]?.lat ?? 0;
  let currentLng = startLng ?? spots[0]?.lng ?? 0;

  while (unvisited.size > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;

    for (const idx of unvisited) {
      const dist = haversineKm(currentLat, currentLng, spots[idx].lat, spots[idx].lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    }

    if (bestIdx === -1) break;
    order.push(bestIdx);
    unvisited.delete(bestIdx);
    currentLat = spots[bestIdx].lat;
    currentLng = spots[bestIdx].lng;
  }

  return order;
}

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

  // 1. Nearest-neighbor greedy initialization
  let order = buildNearestNeighborOrder(spots, startLat, startLng);

  // 2. 2-opt local search improvement (for routes with 3+ spots)
  if (order.length >= 3) {
    order = twoOpt(spots, order, startLat, startLng);
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

export async function buildScheduleAsync(
  spots: Spot[],
  startTime: string,
  endTime: string,
  transportMode: 'walk' | 'transit' | 'drive',
  intensity: Intensity,
  startLat?: number,
  startLng?: number
): Promise<ScheduleResult> {
  // Yield to event loop so UI can show loading state
  await new Promise(r => setTimeout(r, 10));
  return buildSchedule(spots, startTime, endTime, transportMode, intensity, startLat, startLng);
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
