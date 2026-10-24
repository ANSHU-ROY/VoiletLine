// server/services/simulator.ts
import { Server as SocketIOServer } from 'socket.io';
import { IDatabaseAdapter } from '../db/adapter.js';
import { PodEngine } from './podEngine.js';

export interface TrainClockState {
  simulatedTime: string; // "HH:MM:SS"
  timeSeconds: number; // seconds from midnight
  speedMultiplier: number; // 1x, 5x, 30x
  isPaused: boolean;
  upcomingTrain: {
    trainId: string;
    direction: string;
    nextStation: string;
    etaMinutes: number;
  };
}

export class TransitSimulator {
  private db: IDatabaseAdapter;
  private io: SocketIOServer;
  private podEngine: PodEngine;

  private clockSeconds = 18 * 3600 + 12 * 60; // Start at 18:12:00 (peak evening)
  private speedMultiplier = 1;
  private isPaused = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  // Simulated moving drivers
  private simDrivers = [
    { id: 'driver-satish-2', baseLat: 28.3784, baseLng: 77.3148, angle: 0 },
    { id: 'driver-manoj-3', baseLat: 28.4332, baseLng: 77.3144, angle: 1.5 }
  ];

  constructor(db: IDatabaseAdapter, io: SocketIOServer, podEngine: PodEngine) {
    this.db = db;
    this.io = io;
    this.podEngine = podEngine;
  }

  start() {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, 1000);
    console.log('🚄 Transit & Train Clock Simulator started.');
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(1, Math.min(60, multiplier));
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  setTime(timeString: string) {
    const parts = timeString.split(':').map(Number);
    if (parts.length === 3) {
      this.clockSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  fastForwardMinutes(mins: number) {
    this.clockSeconds += mins * 60;
  }

  private tick() {
    if (!this.isPaused) {
      this.clockSeconds += this.speedMultiplier;
      if (this.clockSeconds >= 24 * 3600) {
        this.clockSeconds = 0;
      }
    }

    const timeStr = this.formatTime(this.clockSeconds);

    // Compute next train ETA at Bata Chowk (train scheduled around 18:18:00)
    const targetSeconds = 18 * 3600 + 18 * 60;
    const diff = targetSeconds - this.clockSeconds;
    const etaMinutes = diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;

    const clockState: TrainClockState = {
      simulatedTime: timeStr,
      timeSeconds: this.clockSeconds,
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      upcomingTrain: {
        trainId: 'VL-DOWN-701',
        direction: 'Towards Raja Nahar Singh',
        nextStation: diff > 180 ? 'Mewla Maharajpur' : diff > 60 ? 'Neelam Chowk' : 'Bata Chowk',
        etaMinutes: Math.max(0, etaMinutes)
      }
    };

    // Auto-lock pods when ETA is under 3 minutes (180 seconds)
    if (diff <= 180 && diff > 170) {
      const formingPods = this.db.query<{ id: string }>('SELECT id FROM ride_pods WHERE status = "forming"');
      for (const p of formingPods) {
        this.podEngine.lockPod(p.id);
        this.io.to(`pod:${p.id}`).emit('pod:locked', { podId: p.id, status: 'locked' });
      }
    }

    // Move simulated drivers around stations in small orbits
    for (const d of this.simDrivers) {
      d.angle += 0.05 * this.speedMultiplier;
      const radius = 0.002; // ~200m radius
      const newLat = Math.round((d.baseLat + Math.sin(d.angle) * radius) * 100000) / 100000;
      const newLng = Math.round((d.baseLng + Math.cos(d.angle) * radius) * 100000) / 100000;

      // Update in DB
      this.db.execute(`
        UPDATE driver_profiles
        SET current_lat = ?, current_lng = ?, last_location_update = ?
        WHERE user_id = ? AND is_online = 1
      `, [newLat, newLng, new Date().toISOString(), d.id]);

      // Broadcast location to socket room
      this.io.emit('driver:location_update', {
        driverId: d.id,
        lat: newLat,
        lng: newLng
      });
    }

    // Broadcast train clock state
    this.io.emit('simulator:clock_tick', clockState);
  }

  /**
   * Spawn fake riders into the current forming pod
   */
  spawnFakePodRiders(podId: string, count = 1) {
    const fakeNames = ['Vikram', 'Neha', 'Sunil', 'Kavita', 'Mohit', 'Preeti', 'Deepak'];
    const spawned: Array<{ name: string; memberId: string }> = [];

    this.db.transaction(() => {
      const pod = this.db.queryOne<{ max_seats: number; member_count: number }>(`
        SELECT max_seats,
               (SELECT COUNT(*) FROM pod_members WHERE pod_id = ? AND status = 'joined') as member_count
        FROM ride_pods WHERE id = ?
      `, [podId, podId]);

      if (!pod) return;

      const seatsLeft = pod.max_seats - pod.member_count;
      const toAdd = Math.min(seatsLeft, count);

      for (let i = 0; i < toAdd; i++) {
        const name = fakeNames[Math.floor(Math.random() * fakeNames.length)];
        const fakeRiderId = `fake-rider-${Date.now()}-${i}`;
        const memberId = `pm-fake-${Date.now()}-${i}`;
        const now = new Date().toISOString();

        // Create temporary user record
        this.db.execute(`
          INSERT INTO users (id, phone, name, password_hash, role, created_at)
          VALUES (?, ?, ?, 'sim_hash', 'rider', ?)
        `, [fakeRiderId, `990000${Math.floor(1000 + Math.random() * 9000)}`, name, now]);

        // Join pod
        this.db.execute(`
          INSERT INTO pod_members (id, pod_id, rider_id, rider_first_name, status, joined_at)
          VALUES (?, ?, ?, ?, 'joined', ?)
        `, [memberId, podId, fakeRiderId, name, now]);

        spawned.push({ name, memberId });
      }
    });

    const updated = this.podEngine.getPodDetails(podId);
    if (updated) {
      this.io.to(`pod:${podId}`).emit('pod:updated', updated);
    }
    return { spawned, totalMembers: updated?.members?.length || 0 };
  }

  getClockState(): TrainClockState {
    const timeStr = this.formatTime(this.clockSeconds);
    const targetSeconds = 18 * 3600 + 18 * 60;
    const diff = targetSeconds - this.clockSeconds;
    return {
      simulatedTime: timeStr,
      timeSeconds: this.clockSeconds,
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      upcomingTrain: {
        trainId: 'VL-DOWN-701',
        direction: 'Towards Raja Nahar Singh',
        nextStation: diff > 180 ? 'Mewla Maharajpur' : diff > 60 ? 'Neelam Chowk' : 'Bata Chowk',
        etaMinutes: Math.max(0, Math.round((diff / 60) * 10) / 10)
      }
    };
  }

  private formatTime(totalSeconds: number): string {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
