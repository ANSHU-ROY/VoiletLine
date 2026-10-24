// server/routes/simulatorRoutes.ts
import { Router } from 'express';
import { TransitSimulator } from '../services/simulator.js';
import { VoiceDispatchService } from '../services/voiceDispatch.js';

export function createSimulatorRouter(
  simulator: TransitSimulator,
  voiceDispatch: VoiceDispatchService
) {
  const router = Router();

  // Get current clock state
  router.get('/status', (req, res) => {
    res.json(simulator.getClockState());
  });

  // Set speed multiplier (1x, 5x, 30x)
  router.post('/speed', (req, res) => {
    const { speed } = req.body;
    simulator.setSpeed(Number(speed));
    res.json({ success: true, speed: Number(speed) });
  });

  // Fast forward minutes
  router.post('/forward', (req, res) => {
    const { minutes } = req.body;
    simulator.fastForwardMinutes(Number(minutes) || 5);
    res.json({ success: true, clock: simulator.getClockState() });
  });

  // Pause / resume
  router.post('/toggle-pause', (req, res) => {
    const { paused } = req.body;
    simulator.setPaused(!!paused);
    res.json({ success: true, isPaused: !!paused });
  });

  // Spawn fake riders into a forming pod
  router.post('/spawn-riders', (req, res) => {
    const { podId, count } = req.body;
    const result = simulator.spawnFakePodRiders(podId, Number(count) || 1);
    res.json(result);
  });

  // Trigger test Hindi voice dispatch
  router.post('/test-voice-dispatch', async (req, res) => {
    const { podId, stationName, gateId, dropZoneName, fare } = req.body;
    const result = await voiceDispatch.dispatchLockedPod(
      podId || 'demo-pod-14',
      stationName || 'बाटा चौक',
      Number(gateId) || 1,
      dropZoneName || 'NIT फरीदाबाद',
      Number(fare) || 100
    );
    res.json(result);
  });

  return router;
}
