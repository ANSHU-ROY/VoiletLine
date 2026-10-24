// tests/atomicAcceptance.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../server/db/sqliteAdapter.js';
import { initializeDatabase } from '../server/db/schema.js';
import { RideEngine } from '../server/services/rideEngine.js';

test('Atomic Ride Acceptance - Race Condition & No Double Assignment', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);
  const engine = new RideEngine(db);

  // Setup 1 rider and 2 competing drivers
  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, created_at)
    VALUES
      ('r-compete', '9800000021', 'Rider', 'hash', 'rider', datetime('now')),
      ('d-alpha', '9800000022', 'Driver Alpha', 'hash', 'driver', datetime('now')),
      ('d-beta', '9800000023', 'Driver Beta', 'hash', 'driver', datetime('now'))
  `);

  db.execute(`
    INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number, license_number, preferred_station_slug, status, is_online, current_lat, current_lng)
    VALUES
      ('d-alpha', 'auto', 'HR-01', 'L-01', 'bata-chowk', 'approved', 1, 28.3790, 77.3140),
      ('d-beta', 'auto', 'HR-02', 'L-02', 'bata-chowk', 'approved', 1, 28.3791, 77.3141)
  `);

  // Rider requests ride
  const ride = engine.createSoloRide({
    riderId: 'r-compete',
    type: 'solo',
    stationSlug: 'bata-chowk',
    gateId: 1,
    dropAddress: 'HUDA Sector 12',
    dropLat: 28.3842,
    dropLng: 77.3295,
    pickupLat: 28.3792,
    pickupLng: 77.3138,
    fare: 50
  });

  // Both Driver Alpha and Driver Beta attempt to accept the ride
  const attemptAlpha = engine.acceptRideAtomic(ride.rideId, 'd-alpha');
  const attemptBeta = engine.acceptRideAtomic(ride.rideId, 'd-beta');

  // Exactly one must succeed, the other must fail with conflict error
  assert.equal(attemptAlpha.success, true, 'First driver acceptance must succeed');
  assert.equal(attemptBeta.success, false, 'Second driver acceptance must fail');
  assert.ok(attemptBeta.error.includes('already taken'));

  // Database must show d-alpha assigned and no double assignment
  const finalRide = db.queryOne('SELECT driver_id, status FROM rides WHERE id = ?', [ride.rideId]);
  assert.equal(finalRide.driver_id, 'd-alpha');
  assert.equal(finalRide.status, 'accepted');

  db.close();
});
