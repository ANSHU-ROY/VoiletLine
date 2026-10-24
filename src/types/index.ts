// src/types/index.ts

export interface StationGate {
  id: number;
  name: string;
  coordinates: { lat: number; lng: number };
  landmarks: string;
  lighting?: string;
  safeWalkNotes?: string;
}

export interface DropZone {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  typicalSoloFare: number;
  typicalPodFare: number;
  distanceKm: number;
  description?: string;
}

export interface AutoStand {
  id: string;
  name: string;
  gateId: number;
  coordinates: { lat: number; lng: number };
  capacityEstimate: number;
}

export interface StationData {
  slug: string;
  name: string;
  hindiName: string;
  line: string;
  coordinates: { lat: number; lng: number };
  gates: StationGate[];
  autoStands: AutoStand[];
  dropZones: DropZone[];
  hazards?: HazardReport[];
  stationFares?: Record<string, { podFarePerSeat: number; soloAutoEstimate: number; soloRickshawEstimate: number }>;
}

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: 'rider' | 'driver' | 'admin';
  ratingAvg?: number;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  driverProfile?: DriverProfile;
}

export interface DriverProfile {
  user_id: string;
  vehicle_type: 'auto' | 'e_rickshaw';
  vehicle_number: string;
  license_number: string;
  preferred_station_slug: string;
  preferred_gate_id: number;
  status: 'pending' | 'approved' | 'rejected';
  is_online: number;
  current_lat?: number;
  current_lng?: number;
  earnings_today: number;
  earnings_week: number;
  photo_url?: string;
}

export interface Ride {
  id: string;
  type: 'solo' | 'pod';
  pod_id?: string;
  rider_id: string;
  driver_id?: string;
  station_slug: string;
  gate_id: number;
  drop_zone_id?: string;
  drop_address: string;
  drop_lat: number;
  drop_lng: number;
  pickup_lat: number;
  pickup_lng: number;
  fare: number;
  status: 'requested' | 'searching' | 'accepted' | 'driver_arriving' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_driver_found';
  start_otp: string;
  is_women_only?: number;
  payment_method: 'cash' | 'razorpay';
  payment_status: 'pending' | 'confirmed' | 'refunded';
  rider_name?: string;
  driver_name?: string;
  driver_rating?: number;
  rider_rating?: number;
  vehicle_number?: string;
  vehicle_type?: string;
  driver_photo?: string;
  driver_lat?: number;
  driver_lng?: number;
  created_at: string;
  accepted_at?: string;
}

export interface RidePod {
  id: string;
  pod_code: string;
  pod_color: string;
  pod_shape: string;
  station_slug: string;
  exit_gate_id: number;
  drop_zone_id: string;
  destination_name?: string;
  drop_lat?: number;
  drop_lng?: number;
  target_arrival_time: string;
  direction: string;
  status: 'forming' | 'locked' | 'assigned' | 'boarded' | 'completed' | 'expired';
  is_women_only: number;
  max_seats: number;
  seat_fare: number;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number;
  vehicle_number?: string;
  vehicle_type?: string;
  driver_photo?: string;
  driver_lat?: number;
  driver_lng?: number;
  members: Array<{
    id: string;
    rider_first_name: string;
    status: string;
    joined_at: string;
  }>;
}

export interface HazardReport {
  id: string;
  station_slug: string;
  category: 'broken_streetlight' | 'waterlogged_underpass' | 'isolated_dark_stretch' | 'harassment_stray_alert';
  title: string;
  description: string;
  lat: number;
  lng: number;
  upvotes: number;
  is_active: number;
  moderation_status: 'active' | 'rejected' | 'resolved';
  created_at: string;
  expires_at: string;
  reporter_name?: string;
}
