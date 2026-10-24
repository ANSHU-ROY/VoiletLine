// tests/podMatching.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteAdapter } from '../server/db/sqliteAdapter.js';
import { initializeDatabase } from '../server/db/schema.js';
import { PodEngine } from '../server/services/podEngine.js';

test('Pod Matching Engine - Grouping, Capacity, and Visual Identity', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);
  const engine = new PodEngine(db);

  // Setup riders
  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, created_at)
    VALUES
      ('r1', '9800000001', 'Pooja', 'hash', 'rider', datetime('now')),
      ('r2', '9800000002', 'Neha', 'hash', 'rider', datetime('now')),
      ('r3', '9800000003', 'Aman', 'hash', 'rider', datetime('now')),
      ('r4', '9800000004', 'Kavita', 'hash', 'rider', datetime('now')),
      ('r5', '9800000005', 'Rohan', 'hash', 'rider', datetime('now'))
  `);

  // 1. First rider creates a pod
  const pod1 = engine.joinOrCreatePod({
    riderId: 'r1',
    riderFirstName: 'Pooja',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'nit-faridabad-1-2',
    targetArrivalTime: '18:18:00',
    direction: 'towards_raja_nahar_singh',
    isWomenOnly: false,
    seatFare: 25
  });

  assert.equal(pod1.isNew, true);
  assert.equal(pod1.memberCount, 1);
  assert.equal(pod1.isFull, false);

  // 2. Second rider with same destination joins the same pod
  const pod2 = engine.joinOrCreatePod({
    riderId: 'r2',
    riderFirstName: 'Neha',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'nit-faridabad-1-2',
    targetArrivalTime: '18:18:00',
    direction: 'towards_raja_nahar_singh',
    isWomenOnly: false,
    seatFare: 25
  });

  assert.equal(pod2.podId, pod1.podId, 'Riders with same exit and drop zone should be in same pod');
  assert.equal(pod2.memberCount, 2);

  // 3. Women-only pod should NOT merge with a general pod
  const womenPod = engine.joinOrCreatePod({
    riderId: 'r4',
    riderFirstName: 'Kavita',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'nit-faridabad-1-2',
    targetArrivalTime: '18:18:00',
    direction: 'towards_raja_nahar_singh',
    isWomenOnly: true,
    seatFare: 25
  });

  assert.notEqual(womenPod.podId, pod1.podId, 'Women-only pod must be separate from general pod');

  // 4. Fill up general pod to max capacity (4 seats)
  engine.joinOrCreatePod({
    riderId: 'r3',
    riderFirstName: 'Aman',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'nit-faridabad-1-2',
    targetArrivalTime: '18:18:00',
    direction: 'towards_raja_nahar_singh',
    isWomenOnly: false,
    seatFare: 25
  });

  const fullPod = engine.joinOrCreatePod({
    riderId: 'r5',
    riderFirstName: 'Rohan',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'nit-faridabad-1-2',
    targetArrivalTime: '18:18:00',
    direction: 'towards_raja_nahar_singh',
    isWomenOnly: false,
    seatFare: 25
  });

  assert.equal(fullPod.memberCount, 4);
  assert.equal(fullPod.isFull, true);

  // 5. Verify high contrast visual identity (color + shape + number)
  const details = engine.getPodDetails(pod1.podId);
  assert.ok(details.pod_code.includes('#'));
  assert.ok(details.pod_color.startsWith('#'));
  assert.ok(details.pod_shape.length > 0);

  db.close();
});

test('Pod Matching Engine - Custom Typed Destination Clustering', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);
  const engine = new PodEngine(db);

  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, created_at)
    VALUES
      ('r1', '9800000011', 'Pooja', 'hash', 'rider', datetime('now')),
      ('r2', '9800000012', 'Vikas', 'hash', 'rider', datetime('now')),
      ('r3', '9800000013', 'Anjali', 'hash', 'rider', datetime('now')),
      ('r4', '9800000014', 'Deepak', 'hash', 'rider', datetime('now'))
  `);

  // Rider 1 types custom destination "Sector 16 Market"
  const podA = engine.joinOrCreatePod({
    riderId: 'r1',
    riderFirstName: 'Pooja',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'custom',
    destinationName: 'Sector 16 Market',
    dropLat: 28.4012,
    dropLng: 77.3189,
    targetArrivalTime: '18:30:00',
    seatFare: 25
  });

  assert.equal(podA.isNew, true);
  assert.equal(podA.memberCount, 1);

  // Rider 2 types "Sec 16 HUDA Market" -> should cluster to cluster-sec-16 and join podA!
  const podB = engine.joinOrCreatePod({
    riderId: 'r2',
    riderFirstName: 'Vikas',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'custom',
    destinationName: 'Sec 16 HUDA Market',
    dropLat: 28.4020,
    dropLng: 77.3195,
    targetArrivalTime: '18:30:00',
    seatFare: 25
  });

  assert.equal(podB.podId, podA.podId, 'Riders typing variations of Sector 16 should be grouped in the same pod');
  assert.equal(podB.memberCount, 2);

  // Rider 3 types "World Street Neharpar" -> different cluster, should create new pod
  const podC = engine.joinOrCreatePod({
    riderId: 'r3',
    riderFirstName: 'Anjali',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'custom',
    destinationName: 'World Street Neharpar',
    dropLat: 28.4150,
    dropLng: 77.3480,
    targetArrivalTime: '18:30:00',
    seatFare: 35
  });

  assert.notEqual(podC.podId, podA.podId, 'Different destination area should create a distinct pod');
  assert.equal(podC.isNew, true);

  // Rider 4 types "BPTP Neharpar" -> should join Rider 3's pod!
  const podD = engine.joinOrCreatePod({
    riderId: 'r4',
    riderFirstName: 'Deepak',
    stationSlug: 'bata-chowk',
    exitGateId: 1,
    dropZoneId: 'custom',
    destinationName: 'BPTP Neharpar',
    dropLat: 28.4160,
    dropLng: 77.3490,
    targetArrivalTime: '18:30:00',
    seatFare: 35
  });

  assert.equal(podD.podId, podC.podId, 'Riders heading to Neharpar should join the Neharpar pod');
  assert.equal(podD.memberCount, 2);

  // Verify getActivePods lists both active forming pods
  const activePods = engine.getActivePods('bata-chowk');
  assert.equal(activePods.length, 2);

  db.close();
});
