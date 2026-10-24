// server/routes/driverRoutes.ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { RideEngine } from '../services/rideEngine.js';
import { PodEngine } from '../services/podEngine.js';
import { Server as SocketIOServer } from 'socket.io';

export function createDriverRouter(
  rideEngine: RideEngine,
  podEngine: PodEngine,
  io: SocketIOServer
) {
  const router = Router();

  // All routes require driver role
  router.use(authenticate, requireRole('driver'));

  // 1. Get current driver status and active ride
  router.get('/current', (req, res) => {
    const db = req.db!;
    const profile = db.queryOne<any>('SELECT * FROM driver_profiles WHERE user_id = ?', [req.user!.id]);
    if (!profile) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    let activeRide = null;
    if (profile.current_ride_id) {
      activeRide = rideEngine.getRideDetails(profile.current_ride_id);
    }

    res.json({
      profile,
      activeRide
    });
  });

  // 2. Toggle Online/Offline
  router.put('/toggle-online', (req, res) => {
    const db = req.db!;
    const profile = db.queryOne<{ status: string; is_online: number }>('SELECT status, is_online FROM driver_profiles WHERE user_id = ?', [req.user!.id]);

    if (!profile) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    if (profile.status !== 'approved') {
      return res.status(403).json({
        error: `Cannot go online. Your profile is currently "${profile.status}". Admin approval required.`
      });
    }

    const nextState = profile.is_online ? 0 : 1;
    db.execute('UPDATE driver_profiles SET is_online = ? WHERE user_id = ?', [nextState, req.user!.id]);

    io.emit('driver:status_changed', { driverId: req.user!.id, isOnline: nextState });
    res.json({ isOnline: nextState === 1 });
  });

  // 3. Update Location (Throttled, only while online or active trip)
  router.put('/location', (req, res) => {
    const db = req.db!;
    const { lat, lng } = req.body;

    const profile = db.queryOne<{ is_online: number; current_ride_id: string | null }>(
      'SELECT is_online, current_ride_id FROM driver_profiles WHERE user_id = ?',
      [req.user!.id]
    );

    if (!profile || (!profile.is_online && !profile.current_ride_id)) {
      return res.status(400).json({ error: 'Location tracking active only while online or on a trip.' });
    }

    const now = new Date().toISOString();
    db.execute(`
      UPDATE driver_profiles
      SET current_lat = ?, current_lng = ?, last_location_update = ?
      WHERE user_id = ?
    `, [Number(lat), Number(lng), now, req.user!.id]);

    io.emit('driver:location_update', {
      driverId: req.user!.id,
      lat: Number(lat),
      lng: Number(lng)
    });

    if (profile.current_ride_id) {
      io.to(`ride:${profile.current_ride_id}`).emit('trip:driver_location', {
        rideId: profile.current_ride_id,
        lat: Number(lat),
        lng: Number(lng)
      });
    }

    res.json({ success: true, lat, lng });
  });

  // 4. Gate Queue: Station Gate Statistics and Check-in
  router.get('/queue', (req, res) => {
    const db = req.db!;
    const profile = db.queryOne<{ preferred_station_slug: string; preferred_gate_id: number }>(
      'SELECT preferred_station_slug, preferred_gate_id FROM driver_profiles WHERE user_id = ?',
      [req.user!.id]
    );

    const stationSlug = profile?.preferred_station_slug || 'bata-chowk';

    // Count waiting drivers per gate
    const gateStats = db.query<any>(`
      SELECT gate_id, COUNT(*) as driver_count
      FROM gate_queue_logs
      WHERE station_slug = ? AND status = 'waiting'
      GROUP BY gate_id
    `, [stationSlug]);

    // Count waiting pods per gate
    const podStats = db.query<any>(`
      SELECT exit_gate_id as gate_id, COUNT(*) as pod_count
      FROM ride_pods
      WHERE station_slug = ? AND status IN ('forming', 'locked')
      GROUP BY exit_gate_id
    `, [stationSlug]);

    res.json({
      stationSlug,
      preferredGate: profile?.preferred_gate_id || 1,
      gateStats,
      podStats
    });
  });

  // Check-in or change gate
  router.post('/queue/check-in', (req, res) => {
    const db = req.db!;
    const { stationSlug, gateId } = req.body;

    db.transaction(() => {
      // Mark old queue entry as left
      db.execute(`
        UPDATE gate_queue_logs
        SET status = 'left'
        WHERE driver_id = ? AND status = 'waiting'
      `, [req.user!.id]);

      // Insert new check-in
      const queueId = `q-${Date.now()}`;
      db.execute(`
        INSERT INTO gate_queue_logs (id, station_slug, gate_id, driver_id, checked_in_at, status)
        VALUES (?, ?, ?, ?, ?, 'waiting')
      `, [queueId, stationSlug, Number(gateId), req.user!.id, new Date().toISOString()]);

      db.execute(`
        UPDATE driver_profiles
        SET preferred_station_slug = ?, preferred_gate_id = ?
        WHERE user_id = ?
      `, [stationSlug, Number(gateId), req.user!.id]);
    });

    res.json({ success: true, stationSlug, gateId });
  });

  // 5. Get available pod requests (locked pods ready to claim)
  router.get('/pod-requests', (req, res) => {
    const db = req.db!;
    const profile = db.queryOne<{ preferred_station_slug: string }>(
      'SELECT preferred_station_slug FROM driver_profiles WHERE user_id = ?',
      [req.user!.id]
    );

    const station = profile?.preferred_station_slug || 'bata-chowk';
    const pods = db.query<any>(`
      SELECT p.*,
             (SELECT COUNT(*) FROM pod_members m WHERE m.pod_id = p.id AND m.status = 'joined') as member_count
      FROM ride_pods p
      WHERE p.station_slug = ?
        AND p.status = 'locked'
        AND p.driver_id IS NULL
      ORDER BY p.locked_at DESC
    `, [station]);

    res.json(pods);
  });

  // 6. Atomic Solo Ride Acceptance
  router.post('/rides/:id/accept', (req, res) => {
    const result = rideEngine.acceptRideAtomic(req.params.id, req.user!.id);
    if (!result.success) {
      return res.status(409).json(result);
    }

    io.emit('ride:accepted', { rideId: req.params.id, driverId: req.user!.id });
    io.to(`ride:${req.params.id}`).emit('ride:accepted', result.ride);
    res.json(result);
  });

  // 7. Atomic Ride Pod Claiming
  router.post('/pods/:id/claim', (req, res) => {
    const result = podEngine.claimPodAtomic(req.params.id, req.user!.id);
    if (!result.success) {
      return res.status(409).json(result);
    }

    const podDetails = podEngine.getPodDetails(req.params.id);
    io.to(`pod:${req.params.id}`).emit('pod:assigned', { podId: req.params.id, driverId: req.user!.id, rideId: result.rideId });
    res.json(result);
  });

  // 8. Update Ride State (driver_arriving -> arrived)
  router.post('/rides/:id/arrived', (req, res) => {
    const result = rideEngine.updateRideState(req.params.id, req.user!.id, 'arrived');
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.to(`ride:${req.params.id}`).emit('ride:status_changed', { status: 'arrived' });
    res.json(result);
  });

  // 9. Start Ride with OTP verification
  router.post('/rides/:id/start', (req, res) => {
    const { otp } = req.body;
    const result = rideEngine.startRideWithOtp(req.params.id, req.user!.id, otp);
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.to(`ride:${req.params.id}`).emit('ride:status_changed', { status: 'in_progress' });
    res.json(result);
  });

  // 10. Complete Ride
  router.post('/rides/:id/complete', (req, res) => {
    const result = rideEngine.completeRide(req.params.id, req.user!.id);
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.to(`ride:${req.params.id}`).emit('ride:status_changed', { status: 'completed' });
    res.json(result);
  });

  // 11. Earnings & Trip History
  router.get('/earnings', (req, res) => {
    const db = req.db!;
    const profile = db.queryOne<{ earnings_today: number; earnings_week: number }>(
      'SELECT earnings_today, earnings_week FROM driver_profiles WHERE user_id = ?',
      [req.user!.id]
    );

    const history = db.query<any>(`
      SELECT r.*, u.name as rider_name
      FROM rides r
      JOIN users u ON r.rider_id = u.id
      WHERE r.driver_id = ? AND r.status = 'completed'
      ORDER BY r.completed_at DESC
      LIMIT 15
    `, [req.user!.id]);

    res.json({
      today: profile?.earnings_today || 0,
      week: profile?.earnings_week || 0,
      history
    });
  });

  return router;
}
