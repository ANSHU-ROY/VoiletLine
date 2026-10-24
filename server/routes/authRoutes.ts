// server/routes/authRoutes.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticate } from '../middleware/auth.js';
import { smsService } from '../services/smsService.js';

function cleanPhone(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.substring(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  return digits;
}

export function createAuthRouter() {
  const router = Router();

  // In-memory OTP storage for rapid verification
  const otpStore = new Map<string, { code: string; expiresAt: number }>();

  // 1. Send OTP
  router.post('/send-otp', async (req, res) => {
    const rawPhone = req.body.phone;
    const phone = cleanPhone(rawPhone);
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000 });

    await smsService.sendOtp(phone, code);
    return res.json({
      success: true,
      message: `OTP sent to ${phone}. (Mock demo code: 1234 or check terminal)`,
      demoOtp: '1234'
    });
  });

  // 2. Verify OTP
  router.post('/verify-otp', (req, res) => {
    const { phone: rawPhone, otp } = req.body;
    const phone = cleanPhone(rawPhone);
    const stored = otpStore.get(phone);

    // Allow mock fallback: '1234' is always valid for rapid testing
    const isValid = otp === '1234' || (stored && stored.code === otp && Date.now() < stored.expiresAt);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP. (Demo tip: enter 1234)' });
    }

    otpStore.delete(phone);
    return res.json({ success: true, verified: true });
  });

  // 3. Register Rider or Driver
  router.post('/register', (req, res) => {
    const db = req.db!;
    const {
      name,
      phone: rawPhone,
      email,
      password,
      role = 'rider',
      emergencyName,
      emergencyPhone: rawEmergencyPhone,
      vehicleType,
      vehicleNumber,
      licenseNumber,
      preferredStation,
      preferredGate
    } = req.body;

    const phone = cleanPhone(rawPhone);
    const emergencyPhone = cleanPhone(rawEmergencyPhone);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }
    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    // Check existing phone
    const existing = db.queryOne('SELECT id, role FROM users WHERE phone = ?', [phone]);
    if (existing) {
      return res.status(409).json({
        error: `Mobile number ${phone} is already registered as a ${existing.role}. Please log in instead.`
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const userId = `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    db.transaction(() => {
      db.execute(`
        INSERT INTO users (id, phone, name, email, password_hash, role, emergency_contact_name, emergency_contact_phone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [userId, phone, name.trim(), email ? email.trim().toLowerCase() : null, passwordHash, role, emergencyName || null, emergencyPhone || null, now]);

      if (role === 'driver') {
        db.execute(`
          INSERT INTO driver_profiles (
            user_id, vehicle_type, vehicle_number, license_number,
            preferred_station_slug, preferred_gate_id, status, is_online, photo_url
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')
        `, [
          userId,
          vehicleType || 'auto',
          vehicleNumber ? vehicleNumber.trim().toUpperCase() : 'HR38-NEW-0000',
          licenseNumber ? licenseNumber.trim().toUpperCase() : 'HR-LIC-0000',
          preferredStation || 'bata-chowk',
          Number(preferredGate) || 1
        ]);
      }
    });

    let driverProfile = null;
    if (role === 'driver') {
      driverProfile = db.queryOne('SELECT * FROM driver_profiles WHERE user_id = ?', [userId]);
    }

    const token = generateToken({ id: userId, phone, name: name.trim(), role });
    return res.status(201).json({
      token,
      user: {
        id: userId,
        phone,
        name: name.trim(),
        email: email || null,
        role,
        ratingAvg: 5.0,
        emergencyContactName: emergencyName || null,
        emergencyContactPhone: emergencyPhone || null,
        driverProfile
      }
    });
  });

  // 4. Password Login
  router.post('/login', (req, res) => {
    const db = req.db!;
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your mobile number and password.' });
    }

    const trimmed = identifier.toString().trim();
    const phone = cleanPhone(trimmed);
    const emailLower = trimmed.toLowerCase();

    // Query user by phone or email
    const user = db.queryOne<any>(
      'SELECT * FROM users WHERE phone = ? OR LOWER(email) = ? OR phone = ?',
      [phone, emailLower, trimmed]
    );

    if (!user) {
      return res.status(401).json({
        error: `No account found for "${trimmed}". Click "Sign Up" below to create a new account in 10 seconds!`
      });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        error: `This account is registered as a ${user.role.toUpperCase()}. Please switch to the /${user.role} app or sign up a new ${role} account.`
      });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect password. (Demo password is "password123")' });
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    const token = generateToken({ id: user.id, phone: user.phone, name: user.name, role: user.role });

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = db.queryOne('SELECT * FROM driver_profiles WHERE user_id = ?', [user.id]);
    }

    return res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        ratingAvg: user.rating_avg,
        emergencyContactName: user.emergency_contact_name,
        emergencyContactPhone: user.emergency_contact_phone,
        driverProfile
      }
    });
  });

  // 5. One-Tap OTP Login (Passwordless for Commuters)
  router.post('/login-otp', (req, res) => {
    const db = req.db!;
    const { phone: rawPhone, otp, role = 'rider' } = req.body;
    const phone = cleanPhone(rawPhone);

    if (!phone || phone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const stored = otpStore.get(phone);
    const isValid = otp === '1234' || (stored && stored.code === otp && Date.now() < stored.expiresAt);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired OTP. (Demo tip: enter 1234)' });
    }
    otpStore.delete(phone);

    // Find existing user or auto-register new rider
    let user = db.queryOne<any>('SELECT * FROM users WHERE phone = ?', [phone]);

    if (!user) {
      // Auto-register new commuter
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('violetlink_otp_user', salt);
      const userId = `${role}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const defaultName = `Commuter ${phone.slice(-4)}`;

      db.execute(`
        INSERT INTO users (id, phone, name, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, phone, defaultName, passwordHash, role, now]);

      user = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [userId]);
    }

    const token = generateToken({ id: user.id, phone: user.phone, name: user.name, role: user.role });
    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = db.queryOne('SELECT * FROM driver_profiles WHERE user_id = ?', [user.id]);
    }

    return res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        ratingAvg: user.rating_avg,
        emergencyContactName: user.emergency_contact_name,
        emergencyContactPhone: user.emergency_contact_phone,
        driverProfile
      }
    });
  });

  // 6. Current User Profile
  router.get('/me', authenticate, (req, res) => {
    const db = req.db!;
    const user = db.queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let driverProfile = null;
    if (user.role === 'driver') {
      driverProfile = db.queryOne('SELECT * FROM driver_profiles WHERE user_id = ?', [user.id]);
    }

    return res.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        ratingAvg: user.rating_avg,
        emergencyContactName: user.emergency_contact_name,
        emergencyContactPhone: user.emergency_contact_phone,
        driverProfile
      }
    });
  });

  // 7. Update Emergency Contact
  router.put('/emergency-contact', authenticate, (req, res) => {
    const db = req.db!;
    const { name, phone: rawPhone } = req.body;
    const cleanPhoneVal = cleanPhone(rawPhone);

    db.execute(`
      UPDATE users
      SET emergency_contact_name = ?, emergency_contact_phone = ?
      WHERE id = ?
    `, [name, cleanPhoneVal, req.user!.id]);

    return res.json({ success: true, name, phone: cleanPhoneVal });
  });

  return router;
}
