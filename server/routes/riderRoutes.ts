// server/routes/riderRoutes.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate, requireRole } from '../middleware/auth.js';
import { RideEngine } from '../services/rideEngine.js';
import { PodEngine } from '../services/podEngine.js';
import { HazardService } from '../services/hazardService.js';
import { paymentGateway } from '../services/paymentService.js';
import { getRoute, searchDestinations, calculateFares } from '../services/geoService.js';
import { Server as SocketIOServer } from 'socket.io';

export function createRiderRouter(
  rideEngine: RideEngine,
  podEngine: PodEngine,
  hazardService: HazardService,
  io: SocketIOServer
) {
  const router = Router();
  const stationsDir = path.resolve(process.cwd(), 'data', 'violet-line');
  const faresFile = path.resolve(process.cwd(), 'data', 'fares', 'violet-line-fares.json');

  // Load fares config
  const faresData = JSON.parse(fs.readFileSync(faresFile, 'utf-8'));

  // 1. Get all stations list
  router.get('/stations', (req, res) => {
    try {
      const files = fs.readdirSync(stationsDir).filter(f => f.endsWith('.json'));
      const stations = files.map(file => {
        const raw = fs.readFileSync(path.join(stationsDir, file), 'utf-8');
        const data = JSON.parse(raw);
        return {
          slug: data.slug,
          name: data.name,
          hindiName: data.hindiName,
          coordinates: data.coordinates,
          gatesCount: data.gates.length,
          dropZonesCount: data.dropZones.length
        };
      });
      res.json(stations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Get specific station details
  router.get('/station/:slug', (req, res) => {
    const filePath = path.join(stationsDir, `${req.params.slug}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Station not found' });
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const station = JSON.parse(raw);

    // Attach active hazards
    const hazards = hazardService.getActiveHazards(req.params.slug);
    const stationFares = faresData.stationFares[req.params.slug] || {};

    res.json({
      ...station,
      hazards,
      stationFares
    });
  });

  // Search destinations & autocomplete
  router.get('/destinations/search', (req, res) => {
    const q = req.query.q as string || '';
    const stationSlug = req.query.stationSlug as string || 'bata-chowk';
    const filePath = path.join(stationsDir, `${stationSlug}.json`);
    let stationCoords = { lat: 28.3789, lng: 77.3142 };
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      stationCoords = data.coordinates;
    }
    const results = searchDestinations(q, stationCoords);
    res.json(results);
  });

  // Get active forming pods at station
  router.get('/pods/active', (req, res) => {
    const stationSlug = req.query.stationSlug as string || 'bata-chowk';
    const destination = req.query.destination as string || '';
    const pods = podEngine.getActivePods(stationSlug, destination);
    res.json(pods);
  });

  // 3. Request Solo Ride
  router.post('/rides/request', authenticate, requireRole('rider'), async (req, res) => {
    const {
      stationSlug,
      gateId,
      dropZoneId,
      dropAddress,
      dropLat,
      dropLng,
      pickupLat,
      pickupLng,
      fare,
      isWomenOnly,
      paymentMethod
    } = req.body;

    const ride = rideEngine.createSoloRide({
      riderId: req.user!.id,
      type: 'solo',
      stationSlug,
      gateId: Number(gateId),
      dropZoneId,
      dropAddress,
      dropLat: Number(dropLat),
      dropLng: Number(dropLng),
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      fare: Number(fare),
      isWomenOnly: !!isWomenOnly,
      paymentMethod: paymentMethod || 'cash'
    });

    // Notify nearby drivers via WebSocket
    const nearby = rideEngine.findNearbyOnlineDrivers({ lat: pickupLat, lng: pickupLng });
    io.emit('ride:new_request', {
      rideId: ride.rideId,
      stationSlug,
      gateId,
      dropAddress,
      fare: ride.fare,
      pickup: { lat: pickupLat, lng: pickupLng },
      drop: { lat: dropLat, lng: dropLng }
    });

    res.status(201).json(ride);
  });

  // 4. Join or Form Ride Pod
  router.post('/pods/join', authenticate, requireRole('rider'), (req, res) => {
    const {
      stationSlug,
      exitGateId,
      dropZoneId,
      destinationName,
      dropLat,
      dropLng,
      targetArrivalTime,
      direction,
      isWomenOnly,
      seatFare
    } = req.body;

    const result = podEngine.joinOrCreatePod({
      riderId: req.user!.id,
      riderFirstName: req.user!.name.split(' ')[0],
      stationSlug,
      exitGateId: Number(exitGateId),
      dropZoneId,
      destinationName,
      dropLat: dropLat ? Number(dropLat) : undefined,
      dropLng: dropLng ? Number(dropLng) : undefined,
      targetArrivalTime: targetArrivalTime || '18:18:00',
      direction: direction || 'towards_raja_nahar_singh',
      isWomenOnly: !!isWomenOnly,
      seatFare: Number(seatFare) || 25
    });

    const fullDetails = podEngine.getPodDetails(result.podId);

    // Broadcast update to all pod members
    io.to(`pod:${result.podId}`).emit('pod:updated', fullDetails);

    res.status(201).json({
      ...result,
      pod: fullDetails
    });
  });

  // 5. Get Pod Details
  router.get('/pods/:id', authenticate, (req, res) => {
    const details = podEngine.getPodDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Pod not found' });
    }
    res.json(details);
  });

  // 6. Get Current Active Ride
  router.get('/rides/current', authenticate, (req, res) => {
    const db = req.db!;
    const activeRide = db.queryOne<{ id: string }>(`
      SELECT id FROM rides
      WHERE rider_id = ? AND status NOT IN ('completed', 'cancelled', 'no_driver_found')
      ORDER BY created_at DESC LIMIT 1
    `, [req.user!.id]);

    if (!activeRide) {
      return res.json({ ride: null });
    }

    const details = rideEngine.getRideDetails(activeRide.id);
    res.json({ ride: details });
  });

  // 7. Get Ride Details by ID (Supports public share token)
  router.get('/rides/:id', (req, res) => {
    const details = rideEngine.getRideDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    // Mask phone numbers for public privacy
    const masked = {
      ...details,
      rider_phone_masked: details.rider_phone_full ? details.rider_phone_full.slice(0, 2) + 'XXXXXX' + details.rider_phone_full.slice(-2) : '',
      driver_phone_masked: details.driver_phone_full ? details.driver_phone_full.slice(0, 2) + 'XXXXXX' + details.driver_phone_full.slice(-2) : ''
    };
    delete masked.rider_phone_full;
    delete masked.driver_phone_full;

    res.json(masked);
  });

  // 8. Cancel Ride
  router.post('/rides/:id/cancel', authenticate, (req, res) => {
    const { reason } = req.body;
    const result = rideEngine.cancelRide(req.params.id, req.user!.id, reason);
    if (!result.success) {
      return res.status(400).json(result);
    }

    io.emit('ride:cancelled', { rideId: req.params.id, fee: result.fee });
    res.json(result);
  });

  // 9. Rate Driver
  router.post('/rides/:id/rate', authenticate, (req, res) => {
    const { stars } = req.body;
    const result = rideEngine.rateRide(req.params.id, req.user!.id, Number(stars));
    res.json(result);
  });

  // 10. Trip History
  router.get('/rides/history', authenticate, (req, res) => {
    const db = req.db!;
    const rides = db.query<any>(`
      SELECT r.*, du.name as driver_name, dp.vehicle_number, dp.vehicle_type
      FROM rides r
      LEFT JOIN users du ON r.driver_id = du.id
      LEFT JOIN driver_profiles dp ON r.driver_id = dp.user_id
      WHERE r.rider_id = ?
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [req.user!.id]);

    res.json(rides);
  });

  // 11. Report Hazard
  router.post('/hazards/report', authenticate, (req, res) => {
    const { stationSlug, category, title, description, lat, lng } = req.body;
    const result = hazardService.reportHazard({
      reporterId: req.user!.id,
      stationSlug,
      category,
      title,
      description,
      lat: Number(lat),
      lng: Number(lng)
    });

    io.emit('hazard:new', { stationSlug, hazard: result });
    res.status(201).json(result);
  });

  // 12. Upvote / Confirm Hazard
  router.post('/hazards/:id/upvote', authenticate, (req, res) => {
    const result = hazardService.confirmHazard(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Hazard not found' });
    }
    io.emit('hazard:upvoted', result);
    res.json(result);
  });

  // 13. Route & Corridor Safety Evaluation
  router.post('/route/evaluate', async (req, res) => {
    const { origin, destination, stationSlug } = req.body;
    const route = await getRoute(origin, destination);
    const safety = hazardService.evaluateCorridorSafety(
      stationSlug,
      route.polyline.map(([lat, lng]) => ({ lat, lng }))
    );

    res.json({
      ...route,
      safety
    });
  });

  // 14. Create Razorpay Payment Order
  router.post('/payments/create-order', authenticate, async (req, res) => {
    const { rideId, amount } = req.body;
    try {
      const order = await paymentGateway.createOrder(amount, rideId);
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Verify Razorpay Payment Signature
  router.post('/payments/verify', authenticate, (req, res) => {
    const db = req.db!;
    const { rideId, razorpayOrderId, razorpayPaymentId, razorpaySignature, isMock } = req.body;

    let isValid = false;
    if (isMock || (razorpayOrderId && razorpayOrderId.startsWith('order_mock_'))) {
      isValid = true;
    } else {
      isValid = paymentGateway.verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid payment signature. Transaction unverified.' });
    }

    db.execute(`
      UPDATE rides
      SET payment_method = 'razorpay', payment_status = 'confirmed',
          razorpay_order_id = ?, razorpay_payment_id = ?
      WHERE id = ?
    `, [razorpayOrderId, razorpayPaymentId, rideId]);

    const ride = db.queryOne<{ fare: number; driver_id: string }>('SELECT fare, driver_id FROM rides WHERE id = ?', [rideId]);
    const amount = ride?.fare || 25;

    io.to(`ride:${rideId}`).emit('payment:confirmed', {
      rideId,
      status: 'confirmed',
      method: 'razorpay',
      txnId: razorpayPaymentId,
      amount
    });

    io.emit('driver:fare_received', {
      rideId,
      driverId: ride?.driver_id,
      amount,
      method: 'Online Gateway (Razorpay)',
      txnId: razorpayPaymentId
    });

    res.json({ success: true, paymentStatus: 'confirmed', txnId: razorpayPaymentId });
  });

  // 16. Instant UPI Payment (Google Pay, PhonePe, Paytm, BHIM, Custom VPA)
  router.post('/payments/upi', authenticate, (req, res) => {
    const db = req.db!;
    const { rideId, amount, upiId, upiApp } = req.body;
    const txnId = `UPI_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    db.execute(`
      UPDATE rides
      SET payment_method = 'razorpay', payment_status = 'confirmed',
          razorpay_payment_id = ?
      WHERE id = ?
    `, [txnId, rideId]);

    const ride = db.queryOne<{ fare: number; driver_id: string }>('SELECT fare, driver_id FROM rides WHERE id = ?', [rideId]);
    const paidAmount = Number(amount) || ride?.fare || 25;

    io.to(`ride:${rideId}`).emit('payment:confirmed', {
      rideId,
      status: 'confirmed',
      method: 'upi',
      submethod: upiApp || 'UPI',
      txnId,
      amount: paidAmount,
      upiId: upiId || 'rider@upi'
    });

    io.emit('driver:fare_received', {
      rideId,
      driverId: ride?.driver_id,
      amount: paidAmount,
      method: `UPI (${(upiApp || 'UPI').toUpperCase()})`,
      txnId
    });

    res.json({ success: true, paymentStatus: 'confirmed', txnId, amount: paidAmount });
  });

  // 17. VioletLink Metro Commuter Smart Wallet
  router.get('/wallet', authenticate, (req, res) => {
    const db = req.db!;
    const user = db.queryOne<{ wallet_balance: number }>('SELECT wallet_balance FROM users WHERE id = ?', [req.user!.id]);
    res.json({ balance: user?.wallet_balance ?? 250.0 });
  });

  router.post('/wallet/topup', authenticate, (req, res) => {
    const db = req.db!;
    const amount = Number(req.body.amount) || 100;
    db.execute('UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?', [amount, req.user!.id]);
    const user = db.queryOne<{ wallet_balance: number }>('SELECT wallet_balance FROM users WHERE id = ?', [req.user!.id]);
    res.json({ success: true, balance: user?.wallet_balance ?? 250.0 });
  });

  router.post('/payments/wallet', authenticate, (req, res) => {
    const db = req.db!;
    const { rideId, amount } = req.body;
    const user = db.queryOne<{ wallet_balance: number }>('SELECT wallet_balance FROM users WHERE id = ?', [req.user!.id]);
    const currentBalance = user?.wallet_balance ?? 250.0;
    const fare = Number(amount) || 25;

    if (currentBalance < fare) {
      return res.status(400).json({ error: `Insufficient wallet balance (₹${currentBalance}). Please recharge or use UPI.` });
    }

    const newBalance = currentBalance - fare;
    db.execute('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, req.user!.id]);

    const txnId = `WALLET_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    db.execute(`
      UPDATE rides
      SET payment_method = 'razorpay', payment_status = 'confirmed',
          razorpay_payment_id = ?
      WHERE id = ?
    `, [txnId, rideId]);

    const ride = db.queryOne<{ driver_id: string }>('SELECT driver_id FROM rides WHERE id = ?', [rideId]);

    io.to(`ride:${rideId}`).emit('payment:confirmed', {
      rideId,
      status: 'confirmed',
      method: 'wallet',
      submethod: 'VioletLink Smart Wallet',
      txnId,
      amount: fare,
      newBalance
    });

    io.emit('driver:fare_received', {
      rideId,
      driverId: ride?.driver_id,
      amount: fare,
      method: 'VioletLink Wallet',
      txnId
    });

    res.json({ success: true, paymentStatus: 'confirmed', txnId, amount: fare, newBalance });
  });

  return router;
}
