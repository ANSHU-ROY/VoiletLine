// src/components/MapComponent.tsx
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { HazardReport } from '../types';

interface MapComponentProps {
  center: [number, number];
  zoom?: number;
  gates?: Array<{ id: number; name: string; coordinates: { lat: number; lng: number } }>;
  autoStands?: Array<{ id: string; name: string; coordinates: { lat: number; lng: number } }>;
  drivers?: Array<{ id: string; lat: number; lng: number; vehicleType?: string; name?: string }>;
  hazards?: HazardReport[];
  dropPoint?: [number, number] | null;
  routePolyline?: [number, number][] | null;
  corridorSafetyLevel?: 'green' | 'amber' | 'red';
  onMapClick?: (lat: number, lng: number) => void;
  onHazardUpvote?: (hazardId: string) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  center,
  zoom = 15,
  gates = [],
  autoStands = [],
  drivers = [],
  hazards = [],
  dropPoint = null,
  routePolyline = null,
  corridorSafetyLevel = 'green',
  onMapClick,
  onHazardUpvote
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Free OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center smoothly
  useEffect(() => {
    if (mapInstanceRef.current && center) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update layers, markers, polylines
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const lg = layerGroupRef.current;
    lg.clearLayers();

    // 1. Station Pin (Metro icon)
    const metroIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center w-10 h-10 bg-violet-700 text-white rounded-full shadow-lg border-2 border-white font-bold text-xs">
          DMRC
        </div>
      `,
      className: 'custom-metro-pin',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    L.marker(center, { icon: metroIcon }).bindPopup('<b>DMRC Violet Line Metro Station</b>').addTo(lg);

    // 2. Gates
    gates.forEach(g => {
      const gateIcon = L.divIcon({
        html: `
          <div class="px-2 py-1 bg-amber-500 text-slate-950 font-bold text-xs rounded shadow-md border border-white">
            Gate ${g.id}
          </div>
        `,
        className: 'custom-gate-pin',
        iconSize: [60, 25],
        iconAnchor: [30, 12]
      });
      L.marker([g.coordinates.lat, g.coordinates.lng], { icon: gateIcon })
        .bindPopup(`<b>${g.name}</b><br/>Safe pedestrian meeting point`)
        .addTo(lg);
    });

    // 3. Auto Stands
    autoStands.forEach(s => {
      const standIcon = L.divIcon({
        html: `
          <div class="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow border border-white text-xs font-bold">
            🛺
          </div>
        `,
        className: 'custom-stand-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([s.coordinates.lat, s.coordinates.lng], { icon: standIcon })
        .bindPopup(`<b>${s.name}</b><br/>Official Shared Auto & Rickshaw Bay`)
        .addTo(lg);
    });

    // 4. Moving Drivers
    drivers.forEach(d => {
      const isRickshaw = d.vehicleType === 'e_rickshaw';
      const driverIcon = L.divIcon({
        html: `
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 ${isRickshaw ? 'bg-emerald-500' : 'bg-yellow-400'} text-slate-900 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 text-sm font-bold animate-pulse">
              ${isRickshaw ? '🔋' : '🛺'}
            </div>
            <span class="text-[10px] bg-slate-900 text-white px-1 rounded shadow -mt-1 font-mono">${d.name ? d.name.split(' ')[0] : 'Auto'}</span>
          </div>
        `,
        className: 'custom-driver-pin',
        iconSize: [40, 45],
        iconAnchor: [20, 22]
      });
      L.marker([d.lat, d.lng], { icon: driverIcon })
        .bindPopup(`<b>${d.name || 'Available Driver'}</b><br/>Online & Available`)
        .addTo(lg);
    });

    // 5. Active Hazards
    hazards.forEach(h => {
      let iconEmoji = '⚠️';
      let bgColor = 'bg-rose-600';
      if (h.category === 'broken_streetlight') { iconEmoji = '💡'; bgColor = 'bg-amber-600'; }
      if (h.category === 'waterlogged_underpass') { iconEmoji = '🌊'; bgColor = 'bg-blue-600'; }
      if (h.category === 'harassment_stray_alert') { iconEmoji = '🚨'; bgColor = 'bg-rose-700'; }

      const hazardIcon = L.divIcon({
        html: `
          <div class="w-8 h-8 ${bgColor} text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold radar-ping">
            ${iconEmoji}
          </div>
        `,
        className: 'custom-hazard-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const popupHtml = `
        <div class="p-1">
          <span class="text-xs font-bold uppercase tracking-wider text-rose-600">${h.category.replace('_', ' ')}</span>
          <h4 class="font-bold text-sm text-slate-900">${h.title}</h4>
          <p class="text-xs text-slate-600 my-1">${h.description || 'Community reported hazard'}</p>
          <div class="text-[11px] text-slate-500 font-semibold mb-2">Upvotes: ${h.upvotes} &bull; Active</div>
        </div>
      `;

      L.marker([h.lat, h.lng], { icon: hazardIcon })
        .bindPopup(popupHtml)
        .addTo(lg);
    });

    // 6. Drop Point
    if (dropPoint) {
      const dropIcon = L.divIcon({
        html: `
          <div class="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold">
            🏁
          </div>
        `,
        className: 'custom-drop-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
      });
      L.marker(dropPoint, { icon: dropIcon }).bindPopup('<b>Destination Drop Zone</b>').addTo(lg);
    }

    // 7. Route Polyline with corridor safety styling
    if (routePolyline && routePolyline.length > 0) {
      const routeColor = corridorSafetyLevel === 'green' ? '#10B981' : corridorSafetyLevel === 'amber' ? '#F59E0B' : '#EF4444';
      L.polyline(routePolyline, {
        color: routeColor,
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(lg);
    }
  }, [center, gates, autoStands, drivers, hazards, dropPoint, routePolyline, corridorSafetyLevel]);

  return <div ref={mapContainerRef} className="w-full h-full rounded-2xl overflow-hidden shadow-inner" />;
};
