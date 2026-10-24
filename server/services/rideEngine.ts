// server/services/rideEngine.ts
import { IDatabaseAdapter } from '../db/adapter.js';
import { calculateHaversineDistance, filterAndSortNearbyDrivers, LatLng } from './geoService.js';

export interface CreateRideParams {
  riderId: string;
  type: 'solo' | 'pod';
  stationSlug: string;
  gateId: number;
  dropZoneId?: string;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  pickupLat: number;
  pickupLng: number;
  fare: number;
  isWomenOnly?: boolean;
  paymentMethod?: 'cash' | 'razorpay';
}

export class RideEngine {
  private db: IDatabaseAdapter;

  constructor(db: IDatabaseAdapter) {
    this.db = db;
  }

  /**
   * Request a new solo ride
   */
  createSoloRide(params: CreateRideParams) {
    const rideId = `ride-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const now = new Date().toISOString();

    this.db.execute(`
      INSERT INTO rides (
        id, type, rider_id, station_slug, gate_id, drop_zone_id,
        drop_address, drop_lat, drop_lng, pickup_lat, pickup_lng,
        fare, status, start_otp, is_women_only, payment_method,
        payment_status, created_at
      ) VALUES (
        ?, 'solo', ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, 'searching', ?, ?, ?,
        'pending', ?
      )
    `, [
      rideId,
      params.riderId,
      params.stationSlug,
      params.gateId,
      params.dropZoneId || null,
      params.dropAddress,
      params.dropLat,
      params.dropLng,
      params.pickupLat,
      params.pickupLng,
      params.fare,
      otp,
      params.isWomenOnly ? 1 : 0,
      params.paymentMethod || 'cash',
      now
    ]);

    return {
      rideId,
      otp,
      status: 'searching',
      fare: params.fare
    };
  }

  /**
   * Find approved, online drivers near pickup point
   */
  findNearbyOnlineDrivers(pickup: LatLng, radiusKm = 2.5) {
    const drivers = this.db.query<{
      id: string;
      name: string;
      vehicleNumber: string;
      vehicleType: string;
      rating: number;
      lat: number;
      lng: number;
      photoUrl: string;
    }>(`
      SELECT u.id, u.name, u.rating_avg as rating,
             dp.vehicle_number as vehicleNumber, dp.vehicle_type as vehicleType,
             dp.current_lat as lat, dp.current_lng as lng, dp.photo_url as photoUrl
      FROM users u
      JOIN driver_profiles dp ON u.id = dp.user_id
      WHERE dp.status = 'approved'
        AND dp.is_online = 1
        AND dp.current_ride_id IS NULL
        AND dp.current_lat IS NOT NULL
        AND dp.current_lng IS NOT NULL
        AND u.is_banned = 0
    `);

    return filterAndSortNearbyDrivers(pickup, drivers, radiusKm);
  }

  /**
   * Atomic Ride Acceptance:
   * First driver to accept wins; prevents double-booking race conditions.
   */
  acceptRideAtomic(rideId: string, driverId: string) {
    return this.db.transaction(() => {
      // 1. Verify driver is available
      const driver = this.db.queryOne<{ status: string; is_online: number; current_ride_id: string | null }>(`
        SELECT status, is_online, current_ride_id FROM driver_profiles WHERE user_id = ?
      `, [driverId]);

      if (!driver || driver.status !== 'approved' || !driver.is_online) {
        return { success: false, error: 'Driver is not approved or not online.' };
      }

      if (driver.current_ride_id) {
        return { success: false, error: 'You are already on an active ride.' };
      }

      // 2. Atomic CAS update on ride
      const now = new Date().toISOString();
      const updateResult = this.db.execute(`
        UPDATE rides
        SET status = 'accepted', driver_id = ?, accepted_at = ?
        WHERE id = ? AND status = 'searching' AND driver_id IS NULL
      `, [driverId, now, rideId]);

      if (updateResult.changes === 0) {
        return { success: false, error: 'Ride already taken by another driver or cancelled.' };
      }

      // 3. Mark driver busy
      this.db.execute(`
        UPDATE driver_profiles
        SET current_ride_id = ?
        WHERE user_id = ?
      `, [rideId, driverId]);

      const ride = this.getRideDetails(rideId);
      return { success: true, ride };
    });
  }

  /**
   * Driver updates state: arriving -> arrived
   */
  updateRideState(rideId: string, driverId: string, newStatus: 'driver_arriving' | 'arrived') {
    const ride = this.db.queryOne<{ status: string; driver_id: string }>('SELECT status, driver_id FROM rides WHERE id = ?', [rideId]);
    if (!ride || ride.driver_id !== driverId) {
      return { success: false, error: 'Unauthorized or ride not found.' };
    }

    this.db.execute('UPDATE rides SET status = ? WHERE id = ?', [newStatus, rideId]);
    return { success: true, status: newStatus };
  }

  /**
   * Start ride with 4-digit OTP verification
   */
  startRideWithOtp(rideId: string, driverId: string, enteredOtp: string) {
    return this.db.transaction(() => {
      const ride = this.db.queryOne<{ status: string; driver_id: string; start_otp: string }>(
        'SELECT status, driver_id, start_otp FROM rides WHERE id = ?',
        [rideId]
      );

      if (!ride || ride.driver_id !== driverId) {
        return { success: false, error: 'Unauthorized or ride not found.' };
      }

      if (ride.start_otp !== enteredOtp.trim()) {
        return { success: false, error: 'Incorrect 4-digit start OTP.' };
      }

      const now = new Date().toISOString();
      this.db.execute(`
        UPDATE rides
        SET status = 'in_progress', started_at = ?
        WHERE id = ?
      `, [now, rideId]);

      return { success: true, status: 'in_progress' };
    });
  }

  /**
   * Complete ride and credit driver earnings
   */
  completeRide(rideId: string, driverId: string) {
    return this.db.transaction(() => {
      const ride = this.db.queryOne<{ status: string; driver_id: string; fare: number; payment_method: string }>(
        'SELECT status, driver_id, fare, payment_method FROM rides WHERE id = ?',
        [rideId]
      );

      if (!ride || ride.driver_id !== driverId) {
        return { success: false, error: 'Unauthorized or ride not found.' };
      }

      const now = new Date().toISOString();
      this.db.execute(`
        UPDATE rides
        SET status = 'completed', completed_at = ?,
            payment_status = CASE WHEN payment_method = 'cash' THEN 'confirmed' ELSE payment_status END
        WHERE id = ?
      `, [now, rideId]);

      // Release driver and credit earnings
      this.db.execute(`
        UPDATE driver_profiles
        SET current_ride_id = NULL,
            earnings_today = earnings_today + ?,
            earnings_week = earnings_week + ?
        WHERE user_id = ?
      `, [ride.fare, ride.fare, driverId]);

      return { success: true, status: 'completed', fare: ride.fare };
    });
  }

  /**
   * Cancel ride with 1-minute free cancellation policy
   */
  cancelRide(rideId: string, userId: string, reason = 'Rider requested cancellation') {
    return this.db.transaction(() => {
      const ride = this.db.queryOne<{
        status: string;
        rider_id: string;
        driver_id: string | null;
        accepted_at: string | null;
        fare: number;
      }>('SELECT status, rider_id, driver_id, accepted_at, fare FROM rides WHERE id = ?', [rideId]);

      if (!ride) {
        return { success: false, error: 'Ride not found.' };
      }

      // Check if user is either rider or driver
      if (ride.rider_id !== userId && ride.driver_id !== userId) {
        return { success: false, error: 'Unauthorized to cancel this ride.' };
      }

      // Determine cancellation fee
      let fee = 0;
      if (ride.accepted_at && ride.status !== 'searching') {
        const acceptedTime = new Date(ride.accepted_at).getTime();
        const diffSeconds = (Date.now() - acceptedTime) / 1000;
        if (diffSeconds > 60) {
          fee = 15; // Late cancellation fee
        }
      }

      const now = new Date().toISOString();
      this.db.execute(`
        UPDATE rides
        SET status = 'cancelled', cancelled_at = ?, cancellation_reason = ?, cancellation_fee = ?
        WHERE id = ?
      `, [now, reason, fee, rideId]);

      // Free driver if assigned
      if (ride.driver_id) {
        this.db.execute(`
          UPDATE driver_profiles
          SET current_ride_id = NULL
          WHERE user_id = ?
        `, [ride.driver_id]);
      }

      return { success: true, status: 'cancelled', fee };
    });
  }

  /**
   * Submit mutual rating (1 to 5 stars)
   */
  rateRide(rideId: string, raterId: string, stars: number) {
    const cleanStars = Math.max(1, Math.min(5, Math.round(stars)));
    const ride = this.db.queryOne<{ rider_id: string; driver_id: string; rider_rating: number; driver_rating: number }>(
      'SELECT rider_id, driver_id, rider_rating, driver_rating FROM rides WHERE id = ?',
      [rideId]
    );

    if (!ride) return { success: false, error: 'Ride not found' };

    if (raterId === ride.rider_id) {
      // Rider rating the driver
      this.db.execute('UPDATE rides SET driver_rating = ? WHERE id = ?', [cleanStars, rideId]);
      if (ride.driver_id) {
        const driver = this.db.queryOne<{ rating_avg: number; rating_count: number }>(
          'SELECT rating_avg, rating_count FROM users WHERE id = ?',
          [ride.driver_id]
        );
        if (driver) {
          const newAvg = (driver.rating_avg * driver.rating_count + cleanStars) / (driver.rating_count + 1);
          this.db.execute(
            'UPDATE users SET rating_avg = ?, rating_count = rating_count + 1 WHERE id = ?',
            [Math.round(newAvg * 100) / 100, ride.driver_id]
          );
        }
      }
    } else if (raterId === ride.driver_id) {
      // Driver rating the rider
      this.db.execute('UPDATE rides SET rider_rating = ? WHERE id = ?', [cleanStars, rideId]);
      const rider = this.db.queryOne<{ rating_avg: number; rating_count: number }>(
        'SELECT rating_avg, rating_count FROM users WHERE id = ?',
        [ride.rider_id]
      );
      if (rider) {
        const newAvg = (rider.rating_avg * rider.rating_count + cleanStars) / (rider.rating_count + 1);
        this.db.execute(
          'UPDATE users SET rating_avg = ?, rating_count = rating_count + 1 WHERE id = ?',
          [Math.round(newAvg * 100) / 100, ride.rider_id]
        );
      }
    }

    return { success: true };
  }

  /**
   * Get full details of a ride including driver, vehicle, and rider contact (masked)
   */
  getRideDetails(rideId: string) {
    return this.db.queryOne<any>(`
      SELECT r.*,
             ru.name as rider_name,
             ru.phone as rider_phone_full,
             du.name as driver_name,
             du.phone as driver_phone_full,
             du.rating_avg as driver_rating,
             dp.vehicle_type,
             dp.vehicle_number,
             dp.photo_url as driver_photo,
             dp.current_lat as driver_lat,
             dp.current_lng as driver_lng
      FROM rides r
      JOIN users ru ON r.rider_id = ru.id
      LEFT JOIN users du ON r.driver_id = du.id
      LEFT JOIN driver_profiles dp ON r.driver_id = dp.user_id
      WHERE r.id = ?
    `, [rideId]);
  }
}
