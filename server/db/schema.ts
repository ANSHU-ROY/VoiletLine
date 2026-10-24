// server/db/schema.ts
import { IDatabaseAdapter } from './adapter.js';

export function initializeDatabase(db: IDatabaseAdapter) {
  // Users table (Riders, Drivers, Admins)
  db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('rider', 'driver', 'admin')) NOT NULL,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      is_banned INTEGER DEFAULT 0,
      rating_avg REAL DEFAULT 5.0,
      rating_count INTEGER DEFAULT 1,
      wallet_balance REAL DEFAULT 250.0,
      created_at TEXT NOT NULL
    )
  `);

  // Driver profiles
  db.execute(`
    CREATE TABLE IF NOT EXISTS driver_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      vehicle_type TEXT CHECK(vehicle_type IN ('auto', 'e_rickshaw')) NOT NULL,
      vehicle_number TEXT NOT NULL,
      license_number TEXT NOT NULL,
      preferred_station_slug TEXT NOT NULL,
      preferred_gate_id INTEGER NOT NULL DEFAULT 1,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
      is_online INTEGER DEFAULT 0,
      current_lat REAL,
      current_lng REAL,
      last_location_update TEXT,
      current_ride_id TEXT,
      earnings_today REAL DEFAULT 0,
      earnings_week REAL DEFAULT 0,
      photo_url TEXT
    )
  `);

  // Ride Pods (Shared Commuter Pools)
  db.execute(`
    CREATE TABLE IF NOT EXISTS ride_pods (
      id TEXT PRIMARY KEY,
      pod_code TEXT NOT NULL,
      pod_color TEXT NOT NULL,
      pod_shape TEXT NOT NULL,
      station_slug TEXT NOT NULL,
      exit_gate_id INTEGER NOT NULL,
      drop_zone_id TEXT NOT NULL,
      destination_name TEXT,
      drop_lat REAL,
      drop_lng REAL,
      target_arrival_time TEXT NOT NULL,
      direction TEXT NOT NULL,
      status TEXT CHECK(status IN ('forming', 'locked', 'assigned', 'boarded', 'completed', 'expired')) NOT NULL DEFAULT 'forming',
      is_women_only INTEGER DEFAULT 0,
      max_seats INTEGER DEFAULT 4,
      seat_fare REAL NOT NULL,
      driver_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      locked_at TEXT
    )
  `);

  // Backwards-compatible check for custom typed destinations
  try {
    const podCols = db.query<{ name: string }>('PRAGMA table_info(ride_pods)');
    const colNames = podCols.map(c => c.name);
    if (!colNames.includes('destination_name')) {
      db.execute('ALTER TABLE ride_pods ADD COLUMN destination_name TEXT');
    }
    if (!colNames.includes('drop_lat')) {
      db.execute('ALTER TABLE ride_pods ADD COLUMN drop_lat REAL');
    }
    if (!colNames.includes('drop_lng')) {
      db.execute('ALTER TABLE ride_pods ADD COLUMN drop_lng REAL');
    }
  } catch (e) {
    // Columns already present or non-alterable
  }

  // Backwards-compatible check for commuter wallet_balance
  try {
    const userCols = db.query<{ name: string }>('PRAGMA table_info(users)');
    const uNames = userCols.map(c => c.name);
    if (!uNames.includes('wallet_balance')) {
      db.execute('ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 250.0');
    }
  } catch (e) {
    // Column already present
  }

  // Pod Members
  db.execute(`
    CREATE TABLE IF NOT EXISTS pod_members (
      id TEXT PRIMARY KEY,
      pod_id TEXT NOT NULL REFERENCES ride_pods(id) ON DELETE CASCADE,
      rider_id TEXT NOT NULL REFERENCES users(id),
      rider_first_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('joined', 'boarded', 'cancelled')) NOT NULL DEFAULT 'joined',
      joined_at TEXT NOT NULL,
      UNIQUE(pod_id, rider_id)
    )
  `);

  // Rides (Solo or Assigned Pod Trip)
  db.execute(`
    CREATE TABLE IF NOT EXISTS rides (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('solo', 'pod')) NOT NULL,
      pod_id TEXT REFERENCES ride_pods(id),
      rider_id TEXT REFERENCES users(id),
      driver_id TEXT REFERENCES users(id),
      station_slug TEXT NOT NULL,
      gate_id INTEGER NOT NULL,
      drop_zone_id TEXT,
      drop_address TEXT NOT NULL,
      drop_lat REAL NOT NULL,
      drop_lng REAL NOT NULL,
      pickup_lat REAL NOT NULL,
      pickup_lng REAL NOT NULL,
      fare REAL NOT NULL,
      status TEXT CHECK(status IN (
        'requested', 'searching', 'accepted', 'driver_arriving',
        'arrived', 'in_progress', 'completed', 'cancelled', 'no_driver_found'
      )) NOT NULL DEFAULT 'requested',
      start_otp TEXT NOT NULL,
      is_women_only INTEGER DEFAULT 0,
      payment_method TEXT CHECK(payment_method IN ('cash', 'razorpay')) NOT NULL DEFAULT 'cash',
      payment_status TEXT CHECK(payment_status IN ('pending', 'confirmed', 'refunded')) NOT NULL DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      rider_rating INTEGER,
      driver_rating INTEGER,
      cancellation_reason TEXT,
      cancellation_fee REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT
    )
  `);

  // Hazard Reports (Broken Streetlights, Waterlogged underpasses, etc.)
  db.execute(`
    CREATE TABLE IF NOT EXISTS hazard_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT REFERENCES users(id),
      station_slug TEXT NOT NULL,
      category TEXT CHECK(category IN (
        'broken_streetlight', 'waterlogged_underpass', 'isolated_dark_stretch', 'harassment_stray_alert'
      )) NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      upvotes INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      moderation_status TEXT CHECK(moderation_status IN ('active', 'rejected', 'resolved')) NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);

  // Gate Queues (Fair check-in queue for drivers at stations)
  db.execute(`
    CREATE TABLE IF NOT EXISTS gate_queue_logs (
      id TEXT PRIMARY KEY,
      station_slug TEXT NOT NULL,
      gate_id INTEGER NOT NULL,
      driver_id TEXT NOT NULL REFERENCES users(id),
      checked_in_at TEXT NOT NULL,
      status TEXT CHECK(status IN ('waiting', 'dispatched', 'left')) NOT NULL DEFAULT 'waiting'
    )
  `);

  // Indexes for high performance queries
  db.execute(`CREATE INDEX IF NOT EXISTS idx_driver_status ON driver_profiles(status, is_online)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status, driver_id, rider_id)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_pods_status ON ride_pods(status, station_slug, drop_zone_id)`);
  db.execute(`CREATE INDEX IF NOT EXISTS idx_hazards_active ON hazard_reports(station_slug, is_active, moderation_status)`);
}
