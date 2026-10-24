// server/routes/adminRoutes.ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { HazardService } from '../services/hazardService.js';
import { Server as SocketIOServer } from 'socket.io';

export function createAdminRouter(hazardService: HazardService, io: SocketIOServer) {
  const router = Router();

  // All routes require admin role
  router.use(authenticate, requireRole('admin'));

  // 1. Get drivers list (with status filter)
  router.get('/drivers', (req, res) => {
    const db = req.db!;
    const status = req.query.status as string;

    let query = `
      SELECT u.id, u.name, u.phone, u.email, u.rating_avg, u.is_banned,
             dp.vehicle_type, dp.vehicle_number, dp.license_number,
             dp.preferred_station_slug, dp.preferred_gate_id, dp.status,
             dp.is_online, dp.photo_url, dp.earnings_today, dp.earnings_week
      FROM users u
      JOIN driver_profiles dp ON u.id = dp.user_id
    `;
    const params: any[] = [];
    if (status) {
      query += ' WHERE dp.status = ?';
      params.push(status);
    }
    query += ' ORDER BY u.created_at DESC';

    const drivers = db.query(query, params);
    res.json(drivers);
  });

  // 2. Approve or Reject Driver
  router.put('/drivers/:id/status', (req, res) => {
    const db = req.db!;
    const { status } = req.body; // 'approved' | 'rejected' | 'pending'

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    db.execute('UPDATE driver_profiles SET status = ? WHERE user_id = ?', [status, req.params.id]);

    io.emit('driver:approval_changed', { driverId: req.params.id, status });
    res.json({ success: true, driverId: req.params.id, status });
  });

  // 3. Live Rides & Pods Monitoring
  router.get('/rides/live', (req, res) => {
    const db = req.db!;
    const activeRides = db.query<any>(`
      SELECT r.*,
             ru.name as rider_name, ru.phone as rider_phone,
             du.name as driver_name, du.phone as driver_phone,
             dp.vehicle_number, dp.vehicle_type
      FROM rides r
      JOIN users ru ON r.rider_id = ru.id
      LEFT JOIN users du ON r.driver_id = du.id
      LEFT JOIN driver_profiles dp ON r.driver_id = dp.user_id
      WHERE r.status NOT IN ('completed', 'cancelled')
      ORDER BY r.created_at DESC
    `);

    const activePods = db.query<any>(`
      SELECT p.*,
             (SELECT COUNT(*) FROM pod_members m WHERE m.pod_id = p.id AND m.status = 'joined') as member_count,
             du.name as driver_name
      FROM ride_pods p
      LEFT JOIN users du ON p.driver_id = du.id
      WHERE p.status IN ('forming', 'locked', 'assigned')
      ORDER BY p.created_at DESC
    `);

    res.json({
      rides: activeRides,
      pods: activePods
    });
  });

  // 4. Hazards Queue
  router.get('/hazards', (req, res) => {
    const db = req.db!;
    const hazards = db.query<any>(`
      SELECT h.*, u.name as reporter_name
      FROM hazard_reports h
      LEFT JOIN users u ON h.reporter_id = u.id
      ORDER BY h.created_at DESC
    `);
    res.json(hazards);
  });

  // 5. Moderate Hazard
  router.put('/hazards/:id', (req, res) => {
    const { status } = req.body; // 'active' | 'rejected' | 'resolved'
    const result = hazardService.moderateHazard(req.params.id, status);
    io.emit('hazard:moderated', result);
    res.json(result);
  });

  // 6. Users List
  router.get('/users', (req, res) => {
    const db = req.db!;
    const users = db.query<any>(`
      SELECT id, phone, name, email, role, is_banned, rating_avg, rating_count, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json(users);
  });

  // 7. Ban or Unban User
  router.put('/users/:id/ban', (req, res) => {
    const db = req.db!;
    const { isBanned } = req.body;

    db.execute('UPDATE users SET is_banned = ? WHERE id = ?', [isBanned ? 1 : 0, req.params.id]);

    // If driver, force offline
    db.execute('UPDATE driver_profiles SET is_online = 0 WHERE user_id = ?', [req.params.id]);

    res.json({ success: true, userId: req.params.id, isBanned: !!isBanned });
  });

  // 8. Simple Platform Stats
  router.get('/stats', (req, res) => {
    const db = req.db!;
    const totalRiders = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = "rider"')!.count;
    const totalDrivers = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users WHERE role = "driver"')!.count;
    const pendingDrivers = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM driver_profiles WHERE status = "pending"')!.count;
    const onlineDrivers = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM driver_profiles WHERE is_online = 1')!.count;
    const totalRides = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM rides')!.count;
    const totalPods = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM ride_pods')!.count;
    const activeHazards = db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM hazard_reports WHERE is_active = 1')!.count;

    res.json({
      totalRiders,
      totalDrivers,
      pendingDrivers,
      onlineDrivers,
      totalRides,
      totalPods,
      activeHazards
    });
  });

  return router;
}
