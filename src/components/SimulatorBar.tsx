// src/components/SimulatorBar.tsx
import React, { useState, useEffect } from 'react';
import { FastForward, Play, Pause, Users, Volume2, ChevronUp, ChevronDown, Train } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

interface ClockState {
  simulatedTime: string;
  speedMultiplier: number;
  isPaused: boolean;
  upcomingTrain: {
    trainId: string;
    direction: string;
    nextStation: string;
    etaMinutes: number;
  };
}

export const SimulatorBar: React.FC<{ currentPodId?: string }> = ({ currentPodId }) => {
  const { socket } = useSocket();
  const [clock, setClock] = useState<ClockState>({
    simulatedTime: '18:12:00',
    speedMultiplier: 1,
    isPaused: false,
    upcomingTrain: {
      trainId: 'VL-DOWN-701',
      direction: 'Towards Raja Nahar Singh',
      nextStation: 'Bata Chowk',
      etaMinutes: 6.0
    }
  });
  const [expanded, setExpanded] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // Fetch initial status
    fetch('/api/simulator/status')
      .then(res => res.json())
      .then(data => setClock(data))
      .catch(() => {});

    if (socket) {
      socket.on('simulator:clock_tick', (data: ClockState) => {
        setClock(data);
      });
    }

    return () => {
      if (socket) {
        socket.off('simulator:clock_tick');
      }
    };
  }, [socket]);

  const setSpeed = async (speed: number) => {
    await fetch('/api/simulator/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed })
    });
  };

  const fastForward = async (minutes: number) => {
    const res = await fetch('/api/simulator/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes })
    });
    const data = await res.json();
    if (data.clock) setClock(data.clock);
    showNotice(`⏩ Fast-forwarded +${minutes} mins!`);
  };

  const togglePause = async () => {
    const next = !clock.isPaused;
    await fetch('/api/simulator/toggle-pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: next })
    });
    setClock(prev => ({ ...prev, isPaused: next }));
  };

  const spawnFakeRider = async () => {
    if (!currentPodId) {
      showNotice('Join or view a forming pod first to spawn riders into it!');
      return;
    }
    const res = await fetch('/api/simulator/spawn-riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ podId: currentPodId, count: 1 })
    });
    const data = await res.json();
    showNotice(`👥 Spawned fake rider into pod! Total: ${data.totalMembers}/4`);
  };

  const testVoiceDispatch = async () => {
    showNotice('🔊 Triggering Hindi voice dispatch...');
    await fetch('/api/simulator/test-voice-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        podId: currentPodId || 'pod-emerald-14',
        stationName: 'बाटा चौक',
        gateId: 1,
        dropZoneName: 'NIT फरीदाबाद',
        fare: 100
      })
    });
    showNotice('📢 Voice dispatch sent to Telegram & saved to server audio!');
  };

  const showNotice = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 shadow-2xl transition-all">
      {/* Mini Bar */}
      <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-violet-600/30 text-violet-400 rounded-lg">
            <Train className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="font-mono font-bold text-violet-300">
              {clock.simulatedTime} <span className="text-[10px] text-slate-400 font-sans">({clock.speedMultiplier}x)</span>
            </div>
            <div className="text-[10px] text-slate-300 truncate max-w-[150px]">
              ETA: {clock.upcomingTrain?.etaMinutes}m &bull; {clock.upcomingTrain?.nextStation}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fastForward(2)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-semibold text-[11px] flex items-center gap-1 border border-slate-700 active:scale-95"
          >
            <FastForward className="w-3 h-3 text-amber-400" /> +2m
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white"
          >
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Controls Drawer */}
      {expanded && (
        <div className="max-w-md mx-auto px-4 pb-3 pt-1 border-t border-slate-800/80 space-y-2 text-xs">
          {statusMsg && (
            <div className="p-1.5 bg-violet-950/80 border border-violet-500/40 text-violet-200 rounded text-center font-medium animate-fadeIn">
              {statusMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-slate-400">Clock Speed:</span>
            <div className="flex gap-1">
              {[1, 5, 30].map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 rounded font-bold ${
                    clock.speedMultiplier === s
                      ? 'bg-violet-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
              <button
                onClick={togglePause}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded ml-1"
                title={clock.isPaused ? 'Resume' : 'Pause'}
              >
                {clock.isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={spawnFakeRider}
              className="py-1.5 px-2 bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium rounded flex items-center justify-center gap-1.5 border border-indigo-400/30 active:scale-95"
            >
              <Users className="w-3.5 h-3.5" /> +1 Pod Rider
            </button>
            <button
              onClick={testVoiceDispatch}
              className="py-1.5 px-2 bg-amber-600/80 hover:bg-amber-600 text-white font-medium rounded flex items-center justify-center gap-1.5 border border-amber-400/30 active:scale-95"
            >
              <Volume2 className="w-3.5 h-3.5" /> Voice Dispatch
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
