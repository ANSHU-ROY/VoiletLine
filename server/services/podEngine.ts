// server/services/podEngine.ts
import { IDatabaseAdapter } from '../db/adapter.js';
import { calculateHaversineDistance, normalizeDestinationToCluster, calculateFares, LatLng } from './geoService.js';

export interface PodConfig {
  code: string;
  color: string;
  shape: string;
}

const POD_VISUAL_THEMES: PodConfig[] = [
  { code: 'Emerald Pod', color: '#10B981', shape: 'Emerald Hexagon' },
  { code: 'Sapphire Pod', color: '#2563EB', shape: 'Sapphire Diamond' },
  { code: 'Amber Pod', color: '#D97706', shape: 'Amber Triangle' },
  { code: 'Ruby Pod', color: '#DC2626', shape: 'Ruby Circle' },
  { code: 'Amethyst Pod', color: '#7C3AED', shape: 'Amethyst Star' },
  { code: 'Topaz Pod', color: '#0284C7', shape: 'Topaz Square' }
];

export interface JoinPodRequest {
  riderId: string;
  riderFirstName: string;
  stationSlug: string;
  exitGateId: number;
  dropZoneId?: string;
  destinationName?: string;
  dropLat?: number;
  dropLng?: number;
  targetArrivalTime?: string;
  direction?: string;
  isWomenOnly?: boolean;
  seatFare?: number;
}

export class PodEngine {
  private db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  /**
   * Find or create matching pod for incoming rider based on typed area or drop zone
   */
  joinOrCreatePod(params: JoinPodRequest) {
    const {
      riderId,
      riderFirstName,
      stationSlug,
      exitGateId,
      dropZoneId,
      destinationName,
      dropLat,
      dropLng,
      targetArrivalTime = '18:18:00',
      direction = 'towards_raja_nahar_singh',
      isWomenOnly = false,
      seatFare
    } = params;

    // Normalize destination name to cluster key (e.g. "Sector 15 Main Market" -> "cluster-sec-15")
    const destString = destinationName || dropZoneId || 'NIT Faridabad';
    const { cluster: clusterKey, cleanName } = normalizeDestinationToCluster(destString, dropZoneId);

    const calculatedFare = seatFare || 25;

    return this.db.transaction(() => {
      // 1. Look for existing forming pod matching destination or cluster
      const candidatePods = this.db.query<{
        id: string;
        pod_code: string;
        drop_zone_id: string;
        destination_name: string | null;
        drop_lat: number | null;
        drop_lng: number | null;
        max_seats: number;
        is_women_only: number;
        member_count: number;
      }>(`
        SELECT p.id, p.pod_code, p.drop_zone_id, p.destination_name, p.drop_lat, p.drop_lng, p.max_seats, p.is_women_only,
               (SELECT COUNT(*) FROM pod_members m WHERE m.pod_id = p.id AND m.status = 'joined') as member_count
        FROM ride_pods p
        WHERE p.station_slug = ?
          AND p.status = 'forming'
          AND p.is_women_only = ?
      `, [stationSlug, isWomenOnly ? 1 : 0]);

      // Check for available pod going to the same area or within 1.5 km
      let matchedPod = candidatePods.find(p => {
        if (p.member_count >= p.max_seats) return false;

        // Match by cluster key
        if (p.drop_zone_id === clusterKey || p.drop_zone_id === dropZoneId) return true;

        // Match by normalized destination name
        if (p.destination_name) {
          const pCluster = normalizeDestinationToCluster(p.destination_name).cluster;
          if (pCluster === clusterKey) return true;
        }

        // Match by geographic proximity (within 1.5 km) if coordinates are available
        if (dropLat && dropLng && p.drop_lat && p.drop_lng) {
          const dist = calculateHaversineDistance({ lat: dropLat, lng: dropLng }, { lat: p.drop_lat, lng: p.drop_lng });
          if (dist <= 1.5) return true;
        }

        return false;
      });

      if (matchedPod) {
        // Check if user already in this pod
        const existingMember = this.db.queryOne(
          'SELECT id FROM pod_members WHERE pod_id = ? AND rider_id = ?',
          [matchedPod.id, riderId]
        );

        if (!existingMember) {
          const memberId = `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          this.db.execute(`
            INSERT INTO pod_members (id, pod_id, rider_id, rider_first_name, status, joined_at)
            VALUES (?, ?, ?, ?, 'joined', ?)
          `, [memberId, matchedPod.id, riderId, riderFirstName, new Date().toISOString()]);
        }

        const updatedCount = matchedPod.member_count + (existingMember ? 0 : 1);
        return {
          podId: matchedPod.id,
          isNew: false,
          memberCount: updatedCount,
          isFull: updatedCount >= matchedPod.max_seats,
          destinationName: matchedPod.destination_name || cleanName
        };
      }

      // 2. No matching pod found: Create new forming pod for this typed area!
      const randomTheme = POD_VISUAL_THEMES[Math.floor(Math.random() * POD_VISUAL_THEMES.length)];
      const podNumber = Math.floor(10 + Math.random() * 89);
      const podCode = `${randomTheme.code} #${podNumber}`;
      const podId = `pod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      this.db.execute(`
        INSERT INTO ride_pods (
          id, pod_code, pod_color, pod_shape, station_slug, exit_gate_id,
          drop_zone_id, destination_name, drop_lat, drop_lng, target_arrival_time,
          direction, status, is_women_only, max_seats, seat_fare, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'forming', ?, 4, ?, ?)
      `, [
        podId,
        podCode,
        randomTheme.color,
        randomTheme.shape,
        stationSlug,
        exitGateId,
        clusterKey,
        cleanName,
        dropLat || null,
        dropLng || null,
        targetArrivalTime,
        direction,
        isWomenOnly ? 1 : 0,
        calculatedFare,
        now
      ]);

      const memberId = `pm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      this.db.execute(`
        INSERT INTO pod_members (id, pod_id, rider_id, rider_first_name, status, joined_at)
        VALUES (?, ?, ?, ?, 'joined', ?)
      `, [memberId, podId, riderId, riderFirstName, now]);

      return {
        podId,
        isNew: true,
        memberCount: 1,
        isFull: false,
        destinationName: cleanName
      };
    });
  }

  /**
   * Get all active / forming pods for a station (so riders see pods they can join)
   */
  getActivePods(stationSlug: string, destinationQuery?: string) {
    let sql = `
      SELECT p.*,
             (SELECT COUNT(*) FROM pod_members m WHERE m.pod_id = p.id AND m.status = 'joined') as member_count
      FROM ride_pods p
      WHERE p.station_slug = ? AND p.status IN ('forming', 'locked')
    `;
    const params: any[] = [stationSlug];

    if (destinationQuery && destinationQuery.trim()) {
      const q = destinationQuery.trim().toLowerCase();
      sql += ` AND (LOWER(p.destination_name) LIKE ? OR LOWER(p.drop_zone_id) LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY p.created_at DESC`;
    return this.db.query(sql, params);
  }

  /**
   * Lock pod when train is ~3 mins away or manually requested
   */
  lockPod(podId: string) {
    const pod = this.db.queryOne<{ status: string; member_count: number }>(`
      SELECT p.status, (SELECT COUNT(*) FROM pod_members m WHERE m.pod_id = p.id AND m.status = 'joined') as member_count
      FROM ride_pods p WHERE p.id = ?
    `, [podId]);

    if (!pod || pod.status !== 'forming') return null;

    const now = new Date().toISOString();
    this.db.execute(`
      UPDATE ride_pods
      SET status = 'locked', locked_at = ?
      WHERE id = ?
    `, [now, podId]);

    return { podId, status: 'locked', memberCount: pod.member_count };
  }

  /**
   * Driver atomically claims a locked pod
   */
  claimPodAtomic(podId: string, driverId: string) {
    return this.db.transaction(() => {
      // Check if driver is already on active ride
      const activeRide = this.db.queryOne(
        `SELECT id FROM rides WHERE driver_id = ? AND status IN ('accepted', 'driver_arriving', 'arrived', 'in_progress')`,
        [driverId]
      );
      if (activeRide) {
        return { success: false, error: 'Driver already has an active ride in progress.' };
      }

      // Check if pod is locked and unassigned
      const pod = this.db.queryOne<{
        id: string;
        pod_code: string;
        station_slug: string;
        exit_gate_id: number;
        drop_zone_id: string;
        destination_name: string | null;
        drop_lat: number | null;
        drop_lng: number | null;
        seat_fare: number;
        status: string;
        driver_id: string | null;
      }>(`SELECT * FROM ride_pods WHERE id = ?`, [podId]);

      if (!pod) {
        return { success: false, error: 'Ride Pod not found.' };
      }
      if (pod.status !== 'locked' || pod.driver_id !== null) {
        return { success: false, error: 'Pod already claimed by another driver or expired.' };
      }

      // Assign driver to pod
      this.db.execute(`
        UPDATE ride_pods
        SET status = 'assigned', driver_id = ?
        WHERE id = ? AND status = 'locked' AND driver_id IS NULL
      `, [driverId, podId]);

      // Create a master ride record representing the shared pod trip
      const rideId = `ride-pod-${Date.now()}`;
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const members = this.db.query<{ rider_id: string; rider_first_name: string }>(
        `SELECT rider_id, rider_first_name FROM pod_members WHERE pod_id = ? AND status = 'joined'`,
        [podId]
      );

      const totalFare = pod.seat_fare * Math.max(1, members.length);
      const now = new Date().toISOString();
      const dropAddress = pod.destination_name || 'Shared Drop Zone';

      this.db.execute(`
        INSERT INTO rides (
          id, type, pod_id, rider_id, driver_id, station_slug, gate_id,
          drop_zone_id, drop_address, drop_lat, drop_lng, pickup_lat, pickup_lng,
          fare, status, start_otp, created_at, accepted_at
        ) VALUES (
          ?, 'pod', ?, ?, ?, ?, ?,
          ?, ?, ?, ?, 28.3792, 77.3138,
          ?, 'accepted', ?, ?, ?
        )
      `, [
        rideId,
        podId,
        members[0]?.rider_id || null,
        driverId,
        pod.station_slug,
        pod.exit_gate_id,
        pod.drop_zone_id,
        dropAddress,
        pod.drop_lat || 28.3892,
        pod.drop_lng || 77.2995,
        totalFare,
        otp,
        now,
        now
      ]);

      // Update driver profile with active ride
      this.db.execute(`
        UPDATE driver_profiles
        SET current_ride_id = ?
        WHERE user_id = ?
      `, [rideId, driverId]);

      return {
        success: true,
        rideId,
        podId,
        otp,
        memberCount: members.length,
        totalFare,
        destination: dropAddress
      };
    });
  }

  /**
   * Get full details of a pod (members masked for privacy)
   */
  getPodDetails(podId: string) {
    const pod = this.db.queryOne<any>(`
      SELECT p.*,
             u.name as driver_name,
             u.phone as driver_phone,
             u.rating_avg as driver_rating,
             dp.vehicle_type,
             dp.vehicle_number,
             dp.photo_url as driver_photo,
             dp.current_lat as driver_lat,
             dp.current_lng as driver_lng
      FROM ride_pods p
      LEFT JOIN users u ON p.driver_id = u.id
      LEFT JOIN driver_profiles dp ON p.driver_id = dp.user_id
      WHERE p.id = ?
    `, [podId]);

    if (!pod) return null;

    const members = this.db.query<{ id: string; rider_first_name: string; status: string; joined_at: string }>(`
      SELECT id, rider_first_name, status, joined_at
      FROM pod_members
      WHERE pod_id = ?
    `, [podId]);

    return {
      ...pod,
      destination_name: pod.destination_name || 'NIT Faridabad',
      members
    };
  }
}
