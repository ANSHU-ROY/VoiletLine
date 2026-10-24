// server/services/geoService.ts

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  polyline: [number, number][];
}

export interface DestinationSuggestion {
  id: string;
  name: string;
  area: string;
  cluster: string;
  coordinates: LatLng;
  distanceKm?: number;
  podFare?: number;
  soloFare?: number;
}

export const FARIDABAD_LANDMARKS: DestinationSuggestion[] = [
  { id: 'sec-15-market', name: 'Sector 15 Main Market', area: 'Sector 15', cluster: 'cluster-sec-15', coordinates: { lat: 28.4180, lng: 77.3240 } },
  { id: 'sec-16-huda', name: 'Sector 16 & HUDA Market', area: 'Sector 16', cluster: 'cluster-sec-16', coordinates: { lat: 28.4140, lng: 77.3200 } },
  { id: 'nit-1-market', name: 'NIT 1 Commercial Market', area: 'NIT Faridabad', cluster: 'cluster-nit-faridabad', coordinates: { lat: 28.3892, lng: 77.2995 } },
  { id: 'nit-2-kc', name: 'NIT 2 & KC Cinema Circle', area: 'NIT Faridabad', cluster: 'cluster-nit-faridabad', coordinates: { lat: 28.3920, lng: 77.2960 } },
  { id: 'nit-5-bk', name: 'NIT 5 & BK Hospital', area: 'NIT Faridabad', cluster: 'cluster-nit-faridabad', coordinates: { lat: 28.3970, lng: 77.3010 } },
  { id: 'sec-12-court', name: 'Sector 12 Mini Secretariat & District Court', area: 'Sector 12', cluster: 'cluster-sec-12', coordinates: { lat: 28.3842, lng: 77.3295 } },
  { id: 'sec-12-townpark', name: 'Sector 12 Town Park & Mall Mile', area: 'Sector 12', cluster: 'cluster-sec-12', coordinates: { lat: 28.3880, lng: 77.3250 } },
  { id: 'neharpar-worldstreet', name: 'Omaxe World Street (Sector 79)', area: 'Neharpar', cluster: 'cluster-neharpar', coordinates: { lat: 28.3790, lng: 77.3550 } },
  { id: 'neharpar-bptp', name: 'BPTP Parklands (Sector 75-85)', area: 'Neharpar', cluster: 'cluster-neharpar', coordinates: { lat: 28.3810, lng: 77.3480 } },
  { id: 'manav-rachna-mriirs', name: 'Manav Rachna / MRIIRS University', area: 'Surajkund Road', cluster: 'cluster-manav-rachna', coordinates: { lat: 28.4312, lng: 77.2798 } },
  { id: 'lingayas-vidyapeeth', name: "Lingaya's Vidyapeeth Campus", area: 'Nachauli Road', cluster: 'cluster-lingayas', coordinates: { lat: 28.4290, lng: 77.3650 } },
  { id: 'badkal-lake-resort', name: 'Badkal Lake & Badkal Enclave', area: 'Badkal', cluster: 'cluster-badkal', coordinates: { lat: 28.4230, lng: 77.2910 } },
  { id: 'sec-21c-residential', name: 'Sector 21C & 21A Societies', area: 'Sector 21', cluster: 'cluster-sec-21', coordinates: { lat: 28.4150, lng: 77.3020 } },
  { id: 'sec-28-market', name: 'Sector 28 Huda Market & HP Pump', area: 'Sector 28', cluster: 'cluster-sec-28', coordinates: { lat: 28.4330, lng: 77.3146 } },
  { id: 'sec-29-housing', name: 'Sector 29 & 31 Housing Board', area: 'Sector 29', cluster: 'cluster-sec-29', coordinates: { lat: 28.4250, lng: 77.3320 } },
  { id: 'old-fbd-bazaar', name: 'Old Faridabad Grain & Cloth Market', area: 'Old Faridabad', cluster: 'cluster-old-faridabad', coordinates: { lat: 28.4110, lng: 77.3230 } },
  { id: 'greenfield-colony', name: 'Greenfield Colony Gate 1', area: 'Greenfields', cluster: 'cluster-greenfield', coordinates: { lat: 28.4680, lng: 77.2950 } },
  { id: 'sarai-khawaja', name: 'Sarai Khawaja & Ashoka Enclave', area: 'Sarai', cluster: 'cluster-sarai', coordinates: { lat: 28.4850, lng: 77.3080 } },
  { id: 'nhpc-colony', name: 'NHPC Colony & Surajkund Road', area: 'NHPC', cluster: 'cluster-nhpc', coordinates: { lat: 28.4720, lng: 77.2880 } },
  { id: 'sec-24-industrial', name: 'Sector 24 & 25 Industrial Area', area: 'Sector 24', cluster: 'cluster-sec-24', coordinates: { lat: 28.3620, lng: 77.3220 } },
  { id: 'ballabhgarh-isbt', name: 'Ballabhgarh Bus Stand & City Market', area: 'Ballabhgarh', cluster: 'cluster-ballabhgarh', coordinates: { lat: 28.3382, lng: 77.3200 } },
  { id: 'ballabhgarh-sec-3', name: 'Sector 2 & 3 HUDA Ballabhgarh', area: 'Ballabhgarh', cluster: 'cluster-ballabhgarh', coordinates: { lat: 28.3450, lng: 77.3320 } },
  { id: 'sec-86-bptp', name: 'Sector 86 BPTP Princess Park', area: 'Neharpar', cluster: 'cluster-neharpar', coordinates: { lat: 28.4120, lng: 77.3580 } },
  { id: 'crown-interiorz-mall', name: 'Crown Interiorz Mall (NHPC)', area: 'Mathura Road', cluster: 'cluster-crown', coordinates: { lat: 28.4550, lng: 77.3070 } }
];

/**
 * Great-circle distance between two points in kilometers (Haversine formula)
 */
export function calculateHaversineDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Estimate transparent shared pod fare and solo fare based on distance
 */
export function calculateFares(distKm: number): { podFare: number; soloFare: number } {
  const distance = Math.max(0.5, distKm);
  let podFare = 20;
  if (distance > 2.2) podFare = 25;
  if (distance > 4.0) podFare = 35;
  if (distance > 6.0) podFare = 45;
  if (distance > 8.0) podFare = 50;

  const soloFare = Math.round(30 + distance * 12);
  return { podFare, soloFare };
}

/**
 * Normalize any typed area or destination into a grouping cluster key
 */
export function normalizeDestinationToCluster(name: string, fallbackCluster?: string): { cluster: string; cleanName: string } {
  if (!name || !name.trim()) {
    return { cluster: fallbackCluster || 'cluster-general', cleanName: 'Local Drop Zone' };
  }

  const raw = name.trim();
  const lower = raw.toLowerCase();

  // Check matching sector numbers: e.g. "sector 15", "sec 15", "15 sector"
  const secMatch = lower.match(/(?:sector|sec)\s*([0-9]+[a-z]?)/i) || lower.match(/\b([0-9]{1,2}[a-z]?)\s*(?:sector|sec)\b/i);
  if (secMatch) {
    const secNum = secMatch[1].toLowerCase();
    return { cluster: `cluster-sec-${secNum}`, cleanName: `Sector ${secNum.toUpperCase()}` };
  }

  // Known keyword groupings
  if (lower.includes('nit') || lower.includes('kc cinema') || lower.includes('bk hospital')) {
    return { cluster: 'cluster-nit-faridabad', cleanName: 'NIT Faridabad' };
  }
  if (lower.includes('world street') || lower.includes('neharpar') || lower.includes('greater faridabad') || lower.includes('bptp')) {
    return { cluster: 'cluster-neharpar', cleanName: 'Neharpar / Greater Faridabad' };
  }
  if (lower.includes('manav rachna') || lower.includes('mriirs') || lower.includes('mrei')) {
    return { cluster: 'cluster-manav-rachna', cleanName: 'Manav Rachna Campus' };
  }
  if (lower.includes('lingaya') || lower.includes('nachauli')) {
    return { cluster: 'cluster-lingayas', cleanName: "Lingaya's Campus" };
  }
  if (lower.includes('badkal') || lower.includes('surajkund')) {
    return { cluster: 'cluster-badkal', cleanName: 'Badkal Enclave & Lake' };
  }
  if (lower.includes('ballabhgarh') || lower.includes('sohna')) {
    return { cluster: 'cluster-ballabhgarh', cleanName: 'Ballabhgarh' };
  }
  if (lower.includes('greenfield')) {
    return { cluster: 'cluster-greenfield', cleanName: 'Greenfield Colony' };
  }
  if (lower.includes('ashoka') || lower.includes('sarai')) {
    return { cluster: 'cluster-sarai', cleanName: 'Sarai & Ashoka Enclave' };
  }

  // Fallback: slugify user typed string
  const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    cluster: `cluster-${slug || 'custom'}`,
    cleanName: raw.length > 30 ? raw.slice(0, 30) + '...' : raw
  };
}

/**
 * Search Faridabad destinations with distance calculation and fare estimation
 */
export function searchDestinations(query: string, origin: LatLng): DestinationSuggestion[] {
  const q = (query || '').toLowerCase().trim();

  let matches = FARIDABAD_LANDMARKS;
  if (q.length > 0) {
    matches = FARIDABAD_LANDMARKS.filter(
      d => d.name.toLowerCase().includes(q) || d.area.toLowerCase().includes(q)
    );
  }

  return matches.map(m => {
    const dist = calculateHaversineDistance(origin, m.coordinates);
    const fares = calculateFares(dist);
    return {
      ...m,
      distanceKm: dist,
      podFare: fares.podFare,
      soloFare: fares.soloFare
    };
  }).sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
}

/**
 * Fetch polyline and road distance from OSRM public demo server with local fallback
 */
export async function getRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        return {
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
          polyline: coordinates
        };
      }
    }
  } catch (err) {
    // Network error or timeout, proceed to local fallback
  }

  // Local fallback: straight line + intermediate interpolated waypoints
  const dist = calculateHaversineDistance(origin, destination);
  const steps = 6;
  const polyline: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    polyline.push([
      origin.lat + (destination.lat - origin.lat) * frac,
      origin.lng + (destination.lng - origin.lng) * frac
    ]);
  }

  return {
    distanceKm: Math.max(0.3, dist),
    durationMinutes: Math.max(2, Math.round(dist * 3.5)), // ~17 km/h avg in city traffic
    polyline
  };
}

/**
 * Find nearby drivers within radius (km) sorted by distance
 */
export function filterAndSortNearbyDrivers(
  pickup: LatLng,
  drivers: Array<{ id: string; name: string; vehicleNumber: string; vehicleType: string; lat: number; lng: number; rating: number }>,
  maxRadiusKm = 2.0
) {
  return drivers
    .map(d => {
      const dist = calculateHaversineDistance(pickup, { lat: d.lat, lng: d.lng });
      return { ...d, distanceKm: dist };
    })
    .filter(d => d.distanceKm <= maxRadiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
