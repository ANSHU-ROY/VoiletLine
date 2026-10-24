// server/index.ts
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

import { SQLiteAdapter } from './db/sqliteAdapter.js';
import { initializeDatabase } from './db/schema.js';
import { seedDatabase } from './db/seed.js';

import { RideEngine } from './services/rideEngine.js';
import { PodEngine } from './services/podEngine.js';
import { HazardService } from './services/hazardService.js';
import { TransitSimulator } from './services/simulator.js';
import { VoiceDispatchService } from './services/voiceDispatch.js';

import { createAuthRouter } from './routes/authRoutes.js';
import { createRiderRouter } from './routes/riderRoutes.js';
import { createDriverRouter } from './routes/driverRoutes.js';
import { createAdminRouter } from './routes/adminRoutes.js';
import { createSimulatorRouter } from './routes/simulatorRoutes.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

async function main() {
  console.log('🚀 Initializing VioletLink Server...');

  // Initialize SQLite persistence
  const db = await SQLiteAdapter.create();
  initializeDatabase(db);
  await seedDatabase(db);

  // Initialize Core Services
  const podEngine = new PodEngine(db);
  const rideEngine = new RideEngine(db);
  const hazardService = new HazardService(db);
  const simulator = new TransitSimulator(db, io, podEngine);
  const voiceDispatch = new VoiceDispatchService(podEngine);

  // Start the background train-clock simulator
  simulator.start();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Attach DB to request object
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  // Serve static uploads (audio, photos, etc.)
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Mount API Routers
  app.use('/api/auth', createAuthRouter());
  app.use('/api/rider', createRiderRouter(rideEngine, podEngine, hazardService, io));
  app.use('/api/driver', createDriverRouter(rideEngine, podEngine, io));
  app.use('/api/admin', createAdminRouter(hazardService, io));
  app.use('/api/simulator', createSimulatorRouter(simulator, voiceDispatch));

  // Socket.io event handling
  io.on('connection', (socket) => {
    // Join room for specific ride
    socket.on('join:ride', (rideId: string) => {
      socket.join(`ride:${rideId}`);
    });

    // Join room for specific pod
    socket.on('join:pod', (podId: string) => {
      socket.join(`pod:${podId}`);
    });

    // Join room for station
    socket.on('join:station', (stationSlug: string) => {
      socket.join(`station:${stationSlug}`);
    });

    // Driver location update from client socket
    socket.on('driver:telemetry', (data: { driverId: string; lat: number; lng: number; rideId?: string }) => {
      socket.broadcast.emit('driver:location_update', data);
      if (data.rideId) {
        io.to(`ride:${data.rideId}`).emit('trip:driver_location', data);
      }
    });
  });

  // In production, serve built frontend assets; in development, Vite handles or serves
  const distDir = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(distDir, 'index.html'));
      }
    });
  }

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🟣 VioletLink Platform Live at: http://localhost:${PORT}`);
    console.log(`   Rider App:    http://localhost:${PORT}/rider`);
    console.log(`   Driver App:   http://localhost:${PORT}/driver`);
    console.log(`   Admin Panel:  http://localhost:${PORT}/admin`);
    console.log(`   API Health:   http://localhost:${PORT}/api/auth/me`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown
  const cleanup = () => {
    console.log('Shutting down VioletLink gracefully...');
    simulator.stop();
    db.close();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch(err => {
  console.error('Fatal startup error in VioletLink:', err);
  process.exit(1);
});
