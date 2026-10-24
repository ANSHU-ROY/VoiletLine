// tests/nearestDriver.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../server/db/sqliteAdapter.js';
import { initializeDatabase } from '../server/db/schema.js';
import { RideEngine } from '../server/services/rideEngine.js';
import { calculateHaversineDistance } from '../server/services/geoService.js';

test('Nearest Driver Selection - Radius & Distance Sorting', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);
  const engine = new RideEngine(db);

  // Bata Chowk coordinates: 28.3789, 77.3142
  const pickup = { lat: 28.3789, lng: 77.3142 };

  // Setup drivers at various distances
  // D1: ~200m away (Gate 1) - Online, Approved
  // D2: ~800m away - Online, Approved
  // D3: ~3.5km away (Old Faridabad) - Online, Approved
  // D4: ~100m away - Offline (should be excluded)
  // D5: ~100m away - Pending approval (should be excluded)
  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, rating_avg, rating_count, created_at)
    VALUES
      ('d1', '9800000011', 'Driver Near', 'hash', 'driver', 4.9, 10, datetime('now')),
      ('d2', '9800000012', 'Driver Mid', 'hash', 'driver', 4.8, 10, datetime('now')),
      ('d3', '9800000013', 'Driver Far', 'hash', 'driver', 4.7, 10, datetime('now')),
      ('d4', '9800000014', 'Driver Offline', 'hash', 'driver', 5.0, 10, datetime('now')),
      ('d5', '9800000015', 'Driver Unapproved', 'hash', 'driver', 5.0, 10, datetime('now'))
  `);

  db.execute(`
    INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number, license_number, preferred_station_slug, status, is_online, current_lat, current_lng)
    VALUES
      ('d1', 'auto', 'HR38-01', 'LIC-01', 'bata-chowk', 'approved', 1, 28.3792, 77.3138),
      ('d2', 'auto', 'HR38-02', 'LIC-02', 'bata-chowk', 'approved', 1, 28.3840, 77.3180),
      ('d3', 'auto', 'HR38-03', 'LIC-03', 'bata-chowk', 'approved', 1, 28.4068, 77.3175),
      ('d4', 'auto', 'HR38-04', 'LIC-04', 'bata-chowk', 'approved', 0, 28.3790, 77.3140),
      ('d5', 'auto', 'HR38-05', 'LIC-05', 'bata-chowk', 'pending', 1, 28.3790, 77.3140)
  `);

  // 1. Query within standard 2.0 km radius
  const nearbyDrivers = engine.findNearbyOnlineDrivers(pickup, 2.0);

  // Should contain d1 and d2 only
  assert.equal(nearbyDrivers.length, 2);
  assert.equal(nearbyDrivers[0].id, 'd1', 'Closest driver must be first');
  assert.equal(nearbyDrivers[1].id, 'd2', 'Second closest driver must be second');
  assert.ok(nearbyDrivers[0].distanceKm < nearbyDrivers[1].distanceKm);

  // Offline and unapproved drivers must never be offered rides
  assert.ok(!nearbyDrivers.some(d => d.id === 'd4'));
  assert.ok(!nearbyDrivers.some(d => d.id === 'd5'));

  // 2. Query with expanded 4.0 km radius
  const expandedDrivers = engine.findNearbyOnlineDrivers(pickup, 4.0);
  assert.equal(expandedDrivers.length, 3);
  assert.equal(expandedDrivers[2].id, 'd3');

  db.close();
});
