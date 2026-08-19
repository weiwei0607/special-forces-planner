import { useEffect, useRef, useState } from 'react';
import type { Spot, ItinerarySpot } from '../db';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  spots: Spot[];
  plan?: ItinerarySpot[];
  selectedSpotId?: string | null;
  onSelectSpot?: (id: string) => void;
  height?: string;
  className?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  spots,
  plan,
  selectedSpotId,
  onSelectSpot,
  height = '320px',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineRef = useRef<L.Polyline | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    L.control.attribution({ position: 'bottomright' }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
      polylineRef.current = null;
    };
  }, []);

  // Update markers and polyline when spots/plan change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    if (spots.length === 0) {
      map.setView([25.033, 121.565], 13); // Default to Taipei
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      return;
    }

    // 座標仍是 (0,0)（例如 AI 生成後尚未定位成功）的景點不畫在地圖上，
    // 否則會全部疊在西非外海的 Null Island，看起來像地圖壞掉。
    const validSpots = spots.filter(s => !(s.lat === 0 && s.lng === 0));

    const orderedSpots = plan && plan.length > 0
      ? plan.map(p => validSpots.find(s => s.id === p.spotId)).filter(Boolean) as Spot[]
      : validSpots;

    if (orderedSpots.length === 0) {
      map.setView([25.033, 121.565], 13);
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      return;
    }

    // Create numbered div icons
    orderedSpots.forEach((spot, idx) => {
      const isSelected = selectedSpotId === spot.id;
      const isHovered = hoveredId === spot.id;
      const orderNum = plan && plan.length > 0 ? idx + 1 : null;

      const color = isSelected ? '#f59e0b' : isHovered ? '#38bdf8' : '#71717a';
      const size = isSelected ? 32 : 24;
      const zIndex = isSelected ? 1000 : isHovered ? 500 : 100;

      const html = orderNum
        ? `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:2px solid white;
            border-radius:50%;
            color:white;
            display:flex;align-items:center;justify-content:center;
            font-weight:bold;font-size:${isSelected ? 14 : 12}px;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            transition:all 0.2s;
          ">${orderNum}</div>`
        : `<div style="
            width:${size}px;height:${size}px;
            background:${color};
            border:2px solid white;
            border-radius:50%;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
            transition:all 0.2s;
          "></div>`;

      const icon = L.divIcon({
        html,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([spot.lat, spot.lng], { icon, zIndexOffset: zIndex })
        .addTo(map)
        .bindTooltip(spot.name, {
          direction: 'top',
          offset: [0, -size / 2],
          className: 'bg-zinc-900 text-white text-xs px-2 py-1 rounded border border-zinc-700',
        });

      marker.on('click', () => onSelectSpot?.(spot.id));
      marker.on('mouseover', () => setHoveredId(spot.id));
      marker.on('mouseout', () => setHoveredId(null));

      markersRef.current[spot.id] = marker;
    });

    // Draw route polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (orderedSpots.length >= 2) {
      const latlngs = orderedSpots.map(s => [s.lat, s.lng] as [number, number]);
      const polyline = L.polyline(latlngs, {
        color: '#f59e0b',
        weight: 3,
        opacity: 0.8,
        dashArray: '6 6',
        lineCap: 'round',
      }).addTo(map);
      polylineRef.current = polyline;
    }

    // Fit bounds with padding
    const group = new L.FeatureGroup(Object.values(markersRef.current));
    map.fitBounds(group.getBounds().pad(0.15), { animate: true, duration: 0.5 });
  }, [spots, plan, selectedSpotId, hoveredId, onSelectSpot]);

  // Smooth pan to selected spot
  useEffect(() => {
    if (!selectedSpotId || !mapRef.current) return;
    const marker = markersRef.current[selectedSpotId];
    if (marker) {
      const latLng = marker.getLatLng();
      mapRef.current.panTo(latLng, { animate: true, duration: 0.5 });
    }
  }, [selectedSpotId]);

  return (
    <div
      ref={containerRef}
      className={`rounded-2xl border border-zinc-800 overflow-hidden ${className}`}
      style={{ height, minHeight: height }}
    />
  );
};
