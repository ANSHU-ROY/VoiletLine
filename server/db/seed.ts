// server/db/seed.ts
import bcrypt from 'bcryptjs';
import { IDatabaseAdapter } from './adapter.js';

export async function seedDatabase(db: IDatabaseAdapter) {
  const existingUsers = db.queryOne('SELECT COUNT(*) as count FROM users');
  if (existingUsers && existingUsers.count > 0) {
    return; // Already seeded
  }

  console.log('🌱 Seeding database with initial users, drivers, pods, and hazards...');
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);
  const now = new Date().toISOString();

  // 1. Seed Riders (3 riders)
  const riders = [
    {
      id: 'rider-pooja-1',
      phone: '9876543210',
      name: 'Pooja Sharma',
      email: 'pooja@violetlink.org',
      emergencyName: 'Rajesh Sharma (Brother)',
      emergencyPhone: '9876500001'
    },
    {
      id: 'rider-rahul-2',
      phone: '9876543211',
      name: 'Rahul Verma',
      email: 'rahul@violetlink.org',
      emergencyName: 'Sunita Verma (Mother)',
      emergencyPhone: '9876500002'
    },
    {
      id: 'rider-ananya-3',
      phone: '9876543212',
      name: 'Ananya Singh',
      email: 'ananya@violetlink.org',
      emergencyName: 'Dr. V.P. Singh (Father)',
      emergencyPhone: '9876500003'
    }
  ];

  for (const r of riders) {
    db.execute(`
      INSERT INTO users (id, phone, name, email, password_hash, role, emergency_contact_name, emergency_contact_phone, rating_avg, rating_count, created_at)
      VALUES (?, ?, ?, ?, ?, 'rider', ?, ?, 4.9, 12, ?)
    `, [r.id, r.phone, r.name, r.email, passwordHash, r.emergencyName, r.emergencyPhone, now]);
  }

  // 2. Seed Admin
  db.execute(`
    INSERT INTO users (id, phone, name, email, password_hash, role, created_at)
    VALUES ('admin-central-1', '9999900001', 'Faridabad Metro Transit Admin', 'admin@violetlink.org', ?, 'admin', ?)
  `, [passwordHash, now]);

  // 3. Seed Drivers (5 drivers: 4 approved & online, 1 pending)
  const drivers = [
    {
      id: 'driver-ramesh-1',
      phone: '9811122201',
      name: 'Ramesh Kumar',
      email: 'ramesh@violetlink.org',
      vehicleType: 'auto',
      vehicleNumber: 'HR38-AA-1029',
      licenseNumber: 'HR-FBD-2018-00912',
      preferredStation: 'bata-chowk',
      preferredGate: 1,
      status: 'approved',
      isOnline: 1,
      lat: 28.3793,
      lng: 77.3136,
      rating: 4.85,
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    },
    {
      id: 'driver-satish-2',
      phone: '9811122202',
      name: 'Satish Yadav',
      email: 'satish@violetlink.org',
      vehicleType: 'e_rickshaw',
      vehicleNumber: 'HR38-ER-5521',
      licenseNumber: 'HR-FBD-2020-00441',
      preferredStation: 'bata-chowk',
      preferredGate: 2,
      status: 'approved',
      isOnline: 1,
      lat: 28.3784,
      lng: 77.3148,
      rating: 4.92,
      photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
    },
    {
      id: 'driver-manoj-3',
      phone: '9811122203',
      name: 'Manoj Gurjar',
      email: 'manoj@violetlink.org',
      vehicleType: 'auto',
      vehicleNumber: 'HR38-BB-8819',
      licenseNumber: 'HR-FBD-2016-01892',
      preferredStation: 'sector-28',
      preferredGate: 1,
      status: 'approved',
      isOnline: 1,
      lat: 28.4332,
      lng: 77.3144,
      rating: 4.79,
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
    },
    {
      id: 'driver-vikram-4',
      phone: '9811122204',
      name: 'Vikram Singh',
      email: 'vikram@violetlink.org',
      vehicleType: 'auto',
      vehicleNumber: 'DL1R-TA-4491',
      licenseNumber: 'DL-04-2019-00213',
      preferredStation: 'badarpur-border',
      preferredGate: 1,
      status: 'approved',
      isOnline: 1,
      lat: 28.4952,
      lng: 77.2998,
      rating: 4.88,
      photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
    },
    {
      id: 'driver-dharmendra-5',
      phone: '9811122205',
      name: 'Dharmendra Pal',
      email: 'dharmendra@violetlink.org',
      vehicleType: 'e_rickshaw',
      vehicleNumber: 'HR38-ER-9012',
      licenseNumber: 'HR-FBD-2022-09811',
      preferredStation: 'sector-28',
      preferredGate: 2,
      status: 'pending', // Unapproved, requires admin verification
      isOnline: 0,
      lat: 28.4320,
      lng: 77.3156,
      rating: 5.0,
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'
    }
  ];

  for (const d of drivers) {
    db.execute(`
      INSERT INTO users (id, phone, name, email, password_hash, role, rating_avg, rating_count, created_at)
      VALUES (?, ?, ?, ?, ?, 'driver', ?, 24, ?)
    `, [d.id, d.phone, d.name, d.email, passwordHash, d.rating, now]);

    db.execute(`
      INSERT INTO driver_profiles (
        user_id, vehicle_type, vehicle_number, license_number, preferred_station_slug,
        preferred_gate_id, status, is_online, current_lat, current_lng, last_location_update,
        earnings_today, earnings_week, photo_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 320, 2450, ?)
    `, [d.id, d.vehicleType, d.vehicleNumber, d.licenseNumber, d.preferredStation, d.preferredGate, d.status, d.isOnline, d.lat, d.lng, now, d.photoUrl]);

    // Check into gate queue if approved and online
    if (d.status === 'approved' && d.isOnline) {
      db.execute(`
        INSERT INTO gate_queue_logs (id, station_slug, gate_id, driver_id, checked_in_at, status)
        VALUES (?, ?, ?, ?, ?, 'waiting')
      `, [`queue-${d.id}`, d.preferredStation, d.preferredGate, d.id, now]);
    }
  }

  // 4. Seed Hazard Reports around Bata Chowk, Sector 28, and Badarpur Border
  const hazards = [
    {
      id: 'hazard-1',
      stationSlug: 'bata-chowk',
      category: 'waterlogged_underpass',
      title: 'Waterlogged Pedestrian Subway under Mathura Road',
      description: 'Ankle deep dirty water after rainfall, poor drainage, non-functional pump.',
      lat: 28.3786,
      lng: 77.3146,
      upvotes: 8,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'hazard-2',
      stationSlug: 'sector-28',
      category: 'broken_streetlight',
      title: '4 Non-Functional Sodium Lights on Gate 2 Service Road',
      description: 'Pitch dark 150m stretch between Gate 2 stairs and Sector 27 link road.',
      lat: 28.4322,
      lng: 77.3154,
      upvotes: 14,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    },
    {
      id: 'hazard-3',
      stationSlug: 'badarpur-border',
      category: 'isolated_dark_stretch',
      title: 'Isolated Narrow Alley behind Bus Depot',
      description: 'Zero commercial lighting and stray packs near interstate bus exit.',
      lat: 28.4943,
      lng: 77.3009,
      upvotes: 5,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    }
  ];

  for (const h of hazards) {
    db.execute(`
      INSERT INTO hazard_reports (id, reporter_id, station_slug, category, title, description, lat, lng, upvotes, is_active, moderation_status, created_at, expires_at)
      VALUES (?, 'rider-pooja-1', ?, ?, ?, ?, ?, ?, ?, 1, 'active', ?, ?)
    `, [h.id, h.stationSlug, h.category, h.title, h.description, h.lat, h.lng, h.upvotes, now, h.expiresAt]);
  }

  // 5. Seed a sample forming Ride Pod at Bata Chowk Gate 1
  const podId = 'pod-emerald-14';
  db.execute(`
    INSERT INTO ride_pods (
      id, pod_code, pod_color, pod_shape, station_slug, exit_gate_id,
      drop_zone_id, target_arrival_time, direction, status, is_women_only, max_seats, seat_fare, created_at
    ) VALUES (?, 'Emerald Pod #14', '#10B981', 'Emerald Hexagon', 'bata-chowk', 1, 'nit-faridabad-1-2', '18:18:00', 'towards_raja_nahar_singh', 'forming', 0, 4, 25, ?)
  `, [podId, now]);

  db.execute(`
    INSERT INTO pod_members (id, pod_id, rider_id, rider_first_name, status, joined_at)
    VALUES ('member-pooja', ?, 'rider-pooja-1', 'Pooja', 'joined', ?)
  `, [podId, now]);

  // 6. Seed a sample completed ride for trip history
  db.execute(`
    INSERT INTO rides (
      id, type, rider_id, driver_id, station_slug, gate_id, drop_zone_id,
      drop_address, drop_lat, drop_lng, pickup_lat, pickup_lng, fare,
      status, start_otp, payment_method, payment_status, rider_rating, driver_rating,
      created_at, accepted_at, started_at, completed_at
    ) VALUES (
      'ride-sample-hist-1', 'solo', 'rider-pooja-1', 'driver-ramesh-1',
      'bata-chowk', 1, 'nit-faridabad-1-2',
      'NIT 1 Market, Near KC Cinema', 28.3892, 77.2995, 28.3792, 77.3138, 70,
      'completed', '4192', 'cash', 'confirmed', 5, 5,
      datetime('now', '-2 hours'), datetime('now', '-110 minutes'), datetime('now', '-100 minutes'), datetime('now', '-85 minutes')
    )
  `);

  console.log('✅ Seed data successfully populated.');
}
