import Dexie, { type Table } from 'dexie';

export interface Spot {
  id: string;
  name: string;
  lat: number;
  lng: number;
  openTime: string; // HH:MM
  closeTime: string; // HH:MM
  durationMin: number; // 預計停留分鐘
  price: number; // 門票價格
  tags: string[];
  notes: string;
}

export interface ItinerarySpot {
  spotId: string;
  order: number;
  arrivalTime: string; // HH:MM
  departureTime: string; // HH:MM
  travelTimeFromPrev: number; // 從上一點過來的交通分鐘
  travelMode: 'walk' | 'transit' | 'drive';
  warning?: string;
}

export type Intensity = 'light' | 'medium' | 'hard';

export interface Itinerary {
  id: string;
  title: string;
  city: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  spots: Spot[];
  plan: ItinerarySpot[];
  travelers: number;
  intensity: Intensity;
  totalBudget: number;
  transportMode: 'walk' | 'transit' | 'drive';
  groupName?: string; // 所屬旅程名稱（多日遊的分組）
  dayIndex?: number; // 第幾天
  createdAt: number;
  updatedAt: number;
}

class PlannerDB extends Dexie {
  spots!: Table<Spot>;
  itineraries!: Table<Itinerary>;

  constructor() {
    super('SpecialForcesPlanner');
    this.version(1).stores({
      spots: 'id, name',
      itineraries: 'id, date, updatedAt',
    });
  }
}

export const db = new PlannerDB();

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
