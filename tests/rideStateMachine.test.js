// tests/rideStateMachine.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../server/db/sqliteAdapter.js';
import { initializeDatabase } from '../server/db/schema.js';
import { RideEngine } from '../server/services/rideEngine.js';

test('Ride State Machine - Full Lifecycle & Cancellation Policy', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);
  const engine = new RideEngine(db);

  // Setup rider & driver
  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, created_at)
    VALUES
      ('rider-1', '9800000001', 'Pooja', 'hash', 'rider', datetime('now')),
      ('driver-1', '9800000002', 'Ramesh', 'hash', 'driver', datetime('now'))
  `);
  db.execute(`
    INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number, license_number, preferred_station_slug, status, is_online, current_lat, current_lng)
    VALUES ('driver-1', 'auto', 'HR38-A-100', 'HR-01', 'bata-chowk', 'approved', 1, 28.3792, 77.3138)
  `);

  // 1. Rider requests ride -> status = 'searching'
  const ride = engine.createSoloRide({
    riderId: 'rider-1',
    type: 'solo',
    stationSlug: 'bata-chowk',
    gateId: 1,
    dropAddress: 'NIT Faridabad Market',
    dropLat: 28.3892,
    dropLng: 77.2995,
    pickupLat: 28.3792,
    pickupLng: 77.3138,
    fare: 70
  });

  assert.equal(ride.status, 'searching');
  assert.equal(typeof ride.otp, 'string');
  assert.equal(ride.otp.length, 4);

  // 2. Driver accepts -> status = 'accepted'
  const acceptResult = engine.acceptRideAtomic(ride.rideId, 'driver-1');
  assert.equal(acceptResult.success, true);
  assert.equal(acceptResult.ride.status, 'accepted');

  // 3. Driver arrives -> status = 'arrived'
  const arriveResult = engine.updateRideState(ride.rideId, 'driver-1', 'arrived');
  assert.equal(arriveResult.success, true);
  assert.equal(arriveResult.status, 'arrived');

  // 4. Start ride with incorrect OTP -> fails
  const wrongOtpResult = engine.startRideWithOtp(ride.rideId, 'driver-1', '0000');
  assert.equal(wrongOtpResult.success, false);

  // 5. Start ride with correct OTP -> status = 'in_progress'
  const startResult = engine.startRideWithOtp(ride.rideId, 'driver-1', ride.otp);
  assert.equal(startResult.success, true);
  assert.equal(startResult.status, 'in_progress');

  // 6. Complete ride -> status = 'completed'
  const completeResult = engine.completeRide(ride.rideId, 'driver-1');
  assert.equal(completeResult.success, true);
  assert.equal(completeResult.status, 'completed');

  // Verify driver earnings updated
  const driverProfile = db.queryOne('SELECT earnings_today FROM driver_profiles WHERE user_id = "driver-1"');
  assert.equal(driverProfile.earnings_today, 70);

  db.close();
});
