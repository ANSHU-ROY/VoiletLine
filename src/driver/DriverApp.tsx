// src/driver/DriverApp.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { DriverProfile, Ride, RidePod } from '../types';
import { Power, Check, X, MapPin, Volume2, ShieldCheck, IndianRupee, Users, Navigation, Radio, KeyRound } from 'lucide-react';

export const DriverApp: React.FC = () => {
  const { user, login, register, switchDemoUser } = useAuth();
  const { socket } = useSocket();

  // Language state: 'hi' (Hindi default for drivers) or 'en'
  const [lang, setLang] = useState<'hi' | 'en'>('hi');

  // Driver profile & active ride
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);

  // Incoming solo ride request overlay (15 second countdown)
  const [incomingRequest, setIncomingRequest] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Gate queue stats & locked pod requests
  const [gateQueue, setGateQueue] = useState<{ gateStats: any[]; podStats: any[]; preferredGate: number }>({
    gateStats: [],
    podStats: [],
    preferredGate: 1
  });
  const [podRequests, setPodRequests] = useState<any[]>([]);

  // Live online fare received alert
  const [paidAlert, setPaidAlert] = useState<{ amount: number; method: string; txnId: string } | null>(null);

  // OTP entry pad for starting ride
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');

  // Driver earnings
  const [earnings, setEarnings] = useState<{ today: number; week: number; history: any[] }>({
    today: 320,
    week: 2450,
    history: []
  });

  // Auth form states
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [vehicleType, setVehicleType] = useState<'auto' | 'e_rickshaw'>('auto');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch driver profile & queue on mount
  const refreshDriverState = async () => {
    try {
      const res = await fetch('/api/driver/current', {
        headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setIsOnline(data.profile.is_online === 1);
        setActiveRide(data.activeRide);
      }

      const queueRes = await fetch('/api/driver/queue', {
        headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
      });
      if (queueRes.ok) {
        const qData = await queueRes.json();
        setGateQueue(qData);
      }

      const podRes = await fetch('/api/driver/pod-requests', {
        headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
      });
      if (podRes.ok) {
        const pods = await podRes.json();
        setPodRequests(pods);
      }

      const earnRes = await fetch('/api/driver/earnings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
      });
      if (earnRes.ok) {
        const earnData = await earnRes.json();
        setEarnings(earnData);
      }
    } catch (err) {
      console.error('Failed to load driver state:', err);
    }
  };

  useEffect(() => {
    if (user && user.role === 'driver') {
      refreshDriverState();
    }
  }, [user]);

  // Voice announcement helper using browser Web Speech API (Hindi TTS)
  const announceHindi = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Socket listeners for incoming rides and locked pods
  useEffect(() => {
    if (!socket || !isOnline) return;

    socket.on('ride:new_request', (req: any) => {
      // Show full-screen incoming request with 15-second countdown
      setIncomingRequest(req);
      setCountdown(15);

      const promptText = `नया राइड अनुरोध! गेट ${req.gateId} से ${req.dropAddress}, किराया ${req.fare} रुपये।`;
      announceHindi(promptText);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIncomingRequest(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('ride:accepted', (data: any) => {
      // If another driver accepted it, dismiss incoming request
      if (incomingRequest && incomingRequest.rideId === data.rideId) {
        setIncomingRequest(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

    socket.on('driver:fare_received', (data: any) => {
      setPaidAlert(data);
      const text = lang === 'hi'
        ? `सवारी ने ${data.amount} रुपये का ऑनलाइन भुगतान कर दिया है।`
        : `Online payment of ${data.amount} rupees received.`;
      announceHindi(text);
      setTimeout(() => setPaidAlert(null), 9000);
    });

    return () => {
      socket.off('ride:new_request');
      socket.off('ride:accepted');
      socket.off('driver:fare_received');
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, isOnline, incomingRequest]);

  // Periodic driver telemetry update when online (throttled every 5 seconds)
  useEffect(() => {
    if (!isOnline || !user) return;

    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            fetch('/api/driver/location', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
              },
              body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            }).catch(() => {});
          },
          () => {
            // Simulated fallback jitter around Bata Chowk
            const lat = 28.3792 + (Math.random() - 0.5) * 0.001;
            const lng = 77.3138 + (Math.random() - 0.5) * 0.001;
            fetch('/api/driver/location', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
              },
              body: JSON.stringify({ lat, lng })
            }).catch(() => {});
          }
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOnline, user]);

  // Toggle Online/Offline
  const handleToggleOnline = async () => {
    if (profile?.status !== 'approved') {
      alert(lang === 'hi'
        ? `आप अभी ऑनलाइन नहीं जा सकते! आपकी प्रोफाइल "${profile?.status}" है। एडमिन स्वीकृति आवश्यक है।`
        : `Cannot go online. Profile status is "${profile?.status}". Admin approval required.`
      );
      return;
    }

    const res = await fetch('/api/driver/toggle-online', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    });

    if (res.ok) {
      const data = await res.json();
      setIsOnline(data.isOnline);
      if (data.isOnline) {
        announceHindi(lang === 'hi' ? 'आप ऑनलाइन हैं। राइड अनुरोध खोज रहे हैं।' : 'You are now online.');
      }
    }
  };

  // Accept incoming solo ride
  const handleAcceptRide = async (rideId: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIncomingRequest(null);

    const res = await fetch(`/api/driver/rides/${rideId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    });

    if (res.ok) {
      const data = await res.json();
      setActiveRide(data.ride);
      announceHindi(lang === 'hi' ? 'राइड स्वीकार हो गई! यात्री से मिलने गेट पर जाएं।' : 'Ride accepted!');
    } else {
      const err = await res.json();
      alert(err.error || 'Ride already taken by another driver.');
    }
  };

  // Claim locked ride pod
  const handleClaimPod = async (podId: string) => {
    const res = await fetch(`/api/driver/pods/${podId}/claim`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    });

    if (res.ok) {
      const data = await res.json();
      refreshDriverState();
      announceHindi(lang === 'hi' ? 'राइड पॉड स्वीकार हो गया! सभी यात्री एक ही गेट पर मिलेंगे।' : 'Pod claimed!');
    } else {
      const err = await res.json();
      alert(err.error || 'Pod already claimed.');
    }
  };

  // Driver arrived at gate
  const handleMarkArrived = async () => {
    if (!activeRide) return;
    const res = await fetch(`/api/driver/rides/${activeRide.id}/arrived`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    });
    if (res.ok) {
      setActiveRide(prev => prev ? { ...prev, status: 'arrived' } : null);
      announceHindi(lang === 'hi' ? 'आप स्टेशन गेट पर पहुंच गए हैं। यात्री से 4 अंकों का ओटीपी मांगें।' : 'Arrived at pickup.');
    }
  };

  // Start ride with 4-digit OTP
  const handleStartRide = async () => {
    if (!activeRide || enteredOtp.length !== 4) return;
    setOtpError('');

    const res = await fetch(`/api/driver/rides/${activeRide.id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({ otp: enteredOtp })
    });

    if (res.ok) {
      setActiveRide(prev => prev ? { ...prev, status: 'in_progress' } : null);
      setEnteredOtp('');
      announceHindi(lang === 'hi' ? 'ओटीपी सही है! यात्रा शुरू हुई।' : 'Trip started.');
    } else {
      const err = await res.json();
      setOtpError(err.error || 'Incorrect OTP');
    }
  };

  // Complete ride
  const handleCompleteRide = async () => {
    if (!activeRide) return;
    const res = await fetch(`/api/driver/rides/${activeRide.id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    });

    if (res.ok) {
      announceHindi(lang === 'hi' ? `यात्रा पूरी हुई! किराया ${activeRide.fare} रुपये प्राप्त करें।` : 'Trip completed.');
      setActiveRide(null);
      refreshDriverState();
    }
  };

  // Check in to station gate queue
  const handleCheckInGate = async (gateId: number) => {
    await fetch('/api/driver/queue/check-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({ stationSlug: profile?.preferred_station_slug || 'bata-chowk', gateId })
    });
    refreshDriverState();
  };

  // If not logged in as driver, show high-contrast registration/login
  if (!user || user.role !== 'driver') {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-white p-5 flex flex-col justify-between">
        <div>
          {/* Top Driver Badge */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 bg-yellow-400 text-slate-950 font-black rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                🛺
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-yellow-400">VioletLink ड्राइवर</h1>
                <p className="text-xs font-bold text-slate-400">Faridabad Metro Driver App</p>
              </div>
            </div>

            <button
              onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl font-extrabold text-xs text-yellow-400"
            >
              {lang === 'hi' ? 'English' : 'हिंदी'}
            </button>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-black">
              <button
                type="button"
                onClick={() => { setIsRegistering(false); setAuthError(''); }}
                className={`py-2 rounded-xl transition ${!isRegistering ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-400'}`}
              >
                {lang === 'hi' ? 'ड्राइवर लॉगिन' : 'Driver Login'}
              </button>
              <button
                type="button"
                onClick={() => { setIsRegistering(true); setAuthError(''); }}
                className={`py-2 rounded-xl transition ${isRegistering ? 'bg-yellow-400 text-slate-950 shadow' : 'text-slate-400'}`}
              >
                {lang === 'hi' ? 'नया पंजीकरण' : 'Sign Up'}
              </button>
            </div>

            {/* Error Banner */}
            {authError && (
              <div className="p-3 bg-rose-950/80 border border-rose-500 text-rose-200 rounded-xl text-xs font-bold animate-fadeIn">
                ⚠️ {authError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError('');
                setIsSubmitting(true);
                try {
                  if (isRegistering) {
                    await register({
                      name: nameInput,
                      phone: phoneInput,
                      password: passwordInput,
                      role: 'driver',
                      vehicleType,
                      vehicleNumber,
                      licenseNumber,
                      preferredStation: 'bata-chowk',
                      preferredGate: 1
                    });
                  } else {
                    await login(phoneInput, passwordInput, 'driver');
                  }
                } catch (err: any) {
                  setAuthError(err.message || 'Authentication failed. Please verify and try again.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3"
            >
              {isRegistering && (
                <div>
                  <label className="text-xs font-bold text-yellow-400 block mb-1">पूरा नाम (Full Name)</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    required
                    placeholder="e.g. Satish Yadav"
                    className="w-full py-3 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-yellow-400 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-yellow-400 block mb-1">मोबाइल नंबर (Phone Number)</label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  required
                  placeholder="10-digit mobile"
                  className="w-full py-3 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono font-bold outline-none focus:border-yellow-400 text-base"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-yellow-400 block mb-1">पासवर्ड (Password)</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full py-3 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold outline-none focus:border-yellow-400 text-sm"
                />
              </div>

              {isRegistering && (
                <>
                  <div>
                    <label className="text-xs font-bold text-yellow-400 block mb-1">वाहन प्रकार (Vehicle Type)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setVehicleType('auto')}
                        className={`py-2.5 rounded-xl font-bold text-xs border ${vehicleType === 'auto' ? 'bg-yellow-400 text-slate-950 border-yellow-400' : 'bg-slate-950 text-slate-300 border-slate-700'}`}
                      >
                        🛺 ऑटो (CNG)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleType('e_rickshaw')}
                        className={`py-2.5 rounded-xl font-bold text-xs border ${vehicleType === 'e_rickshaw' ? 'bg-yellow-400 text-slate-950 border-yellow-400' : 'bg-slate-950 text-slate-300 border-slate-700'}`}
                      >
                        🔋 ई-रिक्शा
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-yellow-400 block mb-1">वाहन नंबर (Vehicle Plate)</label>
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={e => setVehicleNumber(e.target.value)}
                      placeholder="e.g. HR38-BB-1234"
                      required
                      className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono uppercase text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-yellow-400 block mb-1">ड्राइविंग लाइसेंस (License Number)</label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={e => setLicenseNumber(e.target.value)}
                      placeholder="e.g. HR-FBD-2022-XXXX"
                      required
                      className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono uppercase text-sm"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-2xl text-lg shadow-xl shadow-yellow-400/20 active:scale-95 transition disabled:opacity-50"
              >
                {isSubmitting
                  ? (lang === 'hi' ? 'कृपया प्रतीक्षा करें...' : 'Processing...')
                  : isRegistering
                  ? (lang === 'hi' ? 'पंजीकरण जमा करें (Submit)' : 'Create Driver Account')
                  : (lang === 'hi' ? 'लॉग इन करें (Log In)' : 'Log In as Driver')}
              </button>
            </form>

            {/* Quick Demo Autofill Button */}
            <div className="pt-2 border-t border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setPhoneInput('9811122201');
                  setPasswordInput('password123');
                  setAuthError('');
                }}
                className="text-xs font-bold text-yellow-400 hover:underline"
              >
                ⚡ ऑटो-भरें: रमेश कुमार (Auto-fill Approved Driver)
              </button>
            </div>
          </div>

          {/* Quick Demo Switcher */}
          <div className="mt-4 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-bold text-slate-400 block mb-1.5">⚡ 1-क्लिक टेस्ट ड्राइवर (Approved)</span>
            <button
              onClick={() => switchDemoUser('driver')}
              className="py-2.5 px-4 bg-yellow-400 text-slate-950 font-black text-sm rounded-xl active:scale-95 shadow"
            >
              रमेश कुमार (Ramesh Kumar - Bata Chowk)
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 mt-4">
          VioletLink Driver Portal &bull; DMRC Last-Mile
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-950 text-white flex flex-col justify-between pb-8 relative">
      {/* Real-time online payment confirmation banner */}
      {paidAlert && (
        <div className="fixed top-14 left-3 right-3 z-50 bg-emerald-600 text-white p-4 rounded-3xl shadow-2xl border-2 border-emerald-300 flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-lg font-black">
              ✓
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                {lang === 'hi' ? 'किराया ऑनलाइन प्राप्त हुआ' : 'Online Fare Received'}
              </div>
              <div className="text-xl font-black">₹{paidAlert.amount}</div>
              <div className="text-[10px] text-emerald-100 font-mono">{paidAlert.method} &bull; {paidAlert.txnId}</div>
            </div>
          </div>
          <button
            onClick={() => setPaidAlert(null)}
            className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header Card: High Contrast Status */}
      <div className="bg-slate-900 border-b-2 border-slate-800 p-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={profile?.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt="Driver"
              className="w-12 h-12 rounded-2xl object-cover border-2 border-yellow-400 shadow-md"
            />
            <div>
              <h2 className="text-base font-black text-white">{profile ? user.name : 'Driver'}</h2>
              <div className="text-xs font-mono font-bold text-yellow-400 flex items-center gap-1">
                <span>{profile?.vehicle_number}</span> &bull; <span>{profile?.vehicle_type === 'auto' ? '🛺 Auto' : '🔋 Rickshaw'}</span>
              </div>
            </div>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs font-extrabold text-yellow-400"
          >
            {lang === 'hi' ? 'EN' : 'हिंदी'}
          </button>
        </div>

        {/* Approval Status Alert if pending */}
        {profile?.status !== 'approved' && (
          <div className="mt-3 p-2.5 bg-amber-500/20 border border-amber-500 rounded-xl text-amber-300 text-xs font-bold text-center">
            ⚠️ {lang === 'hi' ? 'खाता विचाराधीन है (Pending Approval)। एडमिन द्वारा सत्यापन के बाद ऑनलाइन जा सकते हैं।' : 'Driver profile is pending approval. You cannot go online yet.'}
          </div>
        )}
      </div>

      {/* Main Operational Container */}
      <div className="p-4 space-y-4 flex-1">
        {/* BIG ONLINE / OFFLINE TOGGLE BUTTON */}
        {!activeRide && (
          <button
            onClick={handleToggleOnline}
            className={`w-full py-6 rounded-3xl font-black text-2xl flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 border-4 ${
              isOnline
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 shadow-emerald-500/30'
                : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 shadow-rose-600/30'
            }`}
          >
            <Power className="w-8 h-8" />
            <span>
              {isOnline
                ? (lang === 'hi' ? 'ऑनलाइन (ड्यूटी चालू)' : 'ONLINE')
                : (lang === 'hi' ? 'ऑफलाइन (ड्यूटी बंद)' : 'OFFLINE')
              }
            </span>
          </button>
        )}

        {/* ACTIVE RIDE VIEW (When on a trip) */}
        {activeRide && (
          <div className="bg-slate-900 border-2 border-yellow-400 rounded-3xl p-5 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-400">
                {lang === 'hi' ? 'सक्रिय यात्रा (ACTIVE TRIP)' : 'ACTIVE TRIP'}
              </span>
              <span className="px-3 py-1 bg-yellow-400 text-slate-950 rounded-full font-black text-xs">
                ₹{activeRide.fare}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400 font-bold">{lang === 'hi' ? 'पिकअप / ड्रॉप' : 'Pickup & Drop'}</div>
              <div className="text-lg font-black text-white">{activeRide.drop_address}</div>
              <div className="text-xs text-slate-300 font-mono">
                {activeRide.station_slug.toUpperCase()} (Gate {activeRide.gate_id})
              </div>
            </div>

            {/* Arrived Button */}
            {activeRide.status === 'accepted' && (
              <button
                onClick={handleMarkArrived}
                className="w-full py-4 bg-yellow-400 text-slate-950 font-black rounded-2xl text-xl shadow-lg active:scale-95"
              >
                {lang === 'hi' ? '✓ मैं गेट पर पहुंच गया' : '✓ Arrived at Gate'}
              </button>
            )}

            {/* Enter OTP Card */}
            {activeRide.status === 'arrived' && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-700 space-y-3">
                <div className="text-xs font-bold text-yellow-400 text-center">
                  {lang === 'hi' ? 'यात्री का 4-अंकों का ओटीपी दर्ज करें' : 'Enter 4-Digit Rider OTP'}
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={enteredOtp}
                  onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-4xl font-mono font-black tracking-widest py-3 bg-slate-900 border-2 border-yellow-400 rounded-xl text-yellow-400 outline-none"
                  placeholder="••••"
                />
                {otpError && <div className="text-xs text-rose-500 font-bold text-center">{otpError}</div>}
                <button
                  onClick={handleStartRide}
                  disabled={enteredOtp.length !== 4}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-lg disabled:opacity-50"
                >
                  {lang === 'hi' ? 'यात्रा शुरू करें (Start Ride)' : 'Start Ride'}
                </button>
              </div>
            )}

            {/* Complete Ride */}
            {activeRide.status === 'in_progress' && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl text-center">
                  <div className="text-xs font-bold text-emerald-400">
                    {lang === 'hi' ? 'यात्रा प्रगति पर है' : 'Trip in Progress'}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {lang === 'hi' ? 'गंतव्य पर पहुंचने के बाद पूर्ण करें दबाएं' : 'Press complete upon reaching destination'}
                  </div>
                </div>
                <button
                  onClick={handleCompleteRide}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xl shadow-xl shadow-emerald-500/20 active:scale-95"
                >
                  {lang === 'hi' ? '✓ यात्रा पूरी करें (नकद ₹' + activeRide.fare + ' लें)' : 'Complete Trip'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* GATE QUEUE STATS: Autos vs Riders per Gate */}
        {!activeRide && isOnline && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-yellow-400 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-400" />
                {lang === 'hi' ? 'गेट कतार स्थिति (Fair Gate Queue)' : 'Gate Queue Distribution'}
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">
                {profile?.preferred_station_slug?.toUpperCase() || 'BATA CHOWK'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map(gateNum => {
                const count = gateQueue.gateStats.find(g => g.gate_id === gateNum)?.driver_count || 0;
                const pods = gateQueue.podStats.find(p => p.gate_id === gateNum)?.pod_count || 0;
                const isSelected = (gateQueue.preferredGate || 1) === gateNum;

                return (
                  <button
                    key={gateNum}
                    onClick={() => handleCheckInGate(gateNum)}
                    className={`p-3.5 rounded-2xl border text-left transition ${
                      isSelected
                        ? 'border-yellow-400 bg-yellow-400/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm">Gate {gateNum}</span>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                    </div>
                    <div className="text-xs font-bold text-slate-300">🛺 {count} Autos waiting</div>
                    <div className="text-[11px] text-yellow-400 font-semibold mt-0.5">👥 {pods} Pods formed</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* LOCKED POD REQUESTS (Ready to claim) */}
        {!activeRide && isOnline && podRequests.length > 0 && (
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-5 space-y-3 animate-pulse">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-emerald-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {lang === 'hi' ? 'नया राइड पॉड तैयार है!' : 'Locked Pod Ready!'}
              </h3>
              <span className="text-xs bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                {podRequests.length} available
              </span>
            </div>

            {podRequests.map(p => (
              <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-base text-white">{p.pod_code}</span>
                  <span className="font-black text-emerald-400 text-lg">₹{p.seat_fare * p.member_count}</span>
                </div>
                <div className="text-xs text-slate-400">
                  <span>Gate {p.exit_gate_id}</span> &bull; <span>{p.drop_zone_id}</span> &bull; <span>{p.member_count} Passengers</span>
                </div>
                <button
                  onClick={() => handleClaimPod(p.id)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-base active:scale-95"
                >
                  {lang === 'hi' ? 'पूरा पॉड स्वीकार करें (Claim Pod)' : 'Claim Entire Pod'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* EARNINGS SUMMARY */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {lang === 'hi' ? 'आज की कमाई (Today Earnings)' : 'Today Earnings'}
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-black text-yellow-400">₹{earnings.today}</div>
            <div className="text-xs text-slate-400">
              {lang === 'hi' ? 'इस सप्ताह: ₹' + earnings.week : 'This week: ₹' + earnings.week}
            </div>
          </div>
        </div>
      </div>

      {/* FULLSCREEN INCOMING RIDE REQUEST OVERLAY (15-second countdown) */}
      {incomingRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-between animate-fadeIn">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-yellow-400 text-yellow-400 font-mono text-3xl font-black animate-pulse">
              {countdown}s
            </div>
            <h2 className="text-2xl font-black text-yellow-400 tracking-tight">
              {lang === 'hi' ? 'नया राइड अनुरोध!' : 'New Ride Request!'}
            </h2>
            <p className="text-sm text-slate-300 font-bold">
              {incomingRequest.stationSlug.toUpperCase()} (Gate {incomingRequest.gateId})
            </p>
          </div>

          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 text-center space-y-4">
            <div className="text-xs font-bold text-slate-400 uppercase">{lang === 'hi' ? 'गंतव्य (Drop)' : 'Destination'}</div>
            <div className="text-2xl font-black text-white">{incomingRequest.dropAddress}</div>
            <div className="text-5xl font-black text-yellow-400">₹{incomingRequest.fare}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setIncomingRequest(null);
              }}
              className="py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-3xl text-xl flex items-center justify-center gap-2 border border-slate-700 active:scale-95"
            >
              <X className="w-6 h-6" /> {lang === 'hi' ? 'अस्वीकार' : 'Reject'}
            </button>
            <button
              onClick={() => handleAcceptRide(incomingRequest.rideId)}
              className="py-5 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black rounded-3xl text-xl flex items-center justify-center gap-2 shadow-2xl shadow-yellow-400/40 active:scale-95"
            >
              <Check className="w-6 h-6 stroke-[3]" /> {lang === 'hi' ? 'स्वीकार करें' : 'Accept'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
