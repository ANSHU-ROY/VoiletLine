// tests/roleBasedAccess.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateToken, verifyToken, requireRole } from '../server/middleware/auth.js';
import { SQLiteAdapter } from '../server/db/sqliteAdapter.js';
import { initializeDatabase } from '../server/db/schema.js';

test('Role-Based Access Control (RBAC) & Route Protection', async () => {
  const db = await SQLiteAdapter.create(':memory:');
  initializeDatabase(db);

  // 1. Generate tokens with embedded role claims
  const riderToken = generateToken({ id: 'r-test', phone: '9900000001', name: 'Rider Test', role: 'rider' });
  const driverToken = generateToken({ id: 'd-test', phone: '9900000002', name: 'Driver Test', role: 'driver' });
  const adminToken = generateToken({ id: 'a-test', phone: '9900000003', name: 'Admin Test', role: 'admin' });

  const decodedRider = verifyToken(riderToken);
  const decodedDriver = verifyToken(driverToken);
  const decodedAdmin = verifyToken(adminToken);

  assert.equal(decodedRider.role, 'rider');
  assert.equal(decodedDriver.role, 'driver');
  assert.equal(decodedAdmin.role, 'admin');

  // 2. Test requireRole middleware behavior
  const mockReq = (role) => ({ user: { id: 'u1', role }, path: '/api/driver/online', db });
  const mockRes = () => {
    const res = { statusCode: 200, jsonBody: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.jsonBody = data; return res; };
    return res;
  };

  const driverGate = requireRole('driver');
  let nextCalled = false;
  const mockNext = () => { nextCalled = true; };

  // Rider attempting driver gate -> blocked with 403
  const res1 = mockRes();
  nextCalled = false;
  driverGate(mockReq('rider'), res1, mockNext);
  assert.equal(res1.statusCode, 403);
  assert.equal(nextCalled, false);

  // Admin gate testing
  const adminGate = requireRole('admin');
  const res2 = mockRes();
  nextCalled = false;
  adminGate(mockReq('rider'), res2, mockNext);
  assert.equal(res2.statusCode, 403);
  assert.equal(nextCalled, false);

  // 3. Unapproved driver attempting to go online -> blocked
  db.execute(`
    INSERT INTO users (id, phone, name, password_hash, role, created_at)
    VALUES ('d-unapproved', '9811199999', 'Pending Driver', 'hash', 'driver', datetime('now'))
  `);
  db.execute(`
    INSERT INTO driver_profiles (user_id, vehicle_type, vehicle_number, license_number, preferred_station_slug, status)
    VALUES ('d-unapproved', 'auto', 'HR38-00', 'L-00', 'bata-chowk', 'pending')
  `);

  const res3 = mockRes();
  nextCalled = false;
  const unapprovedReq = {
    user: { id: 'd-unapproved', role: 'driver' },
    path: '/api/driver/toggle-online',
    db
  };
  driverGate(unapprovedReq, res3, mockNext);
  assert.equal(res3.statusCode, 403);
  assert.ok(res3.jsonBody.error.includes('pending'));
  assert.equal(nextCalled, false);

  db.close();
});
