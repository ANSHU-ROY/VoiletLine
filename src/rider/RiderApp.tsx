// src/rider/RiderApp.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { StationData, Ride, RidePod, HazardReport } from '../types';
import { MapComponent } from '../components/MapComponent';
import { SimulatorBar } from '../components/SimulatorBar';
import { PaymentModal } from '../components/PaymentModal';
import {
  Shield, AlertTriangle, Users, Navigation, Phone, Share2,
  Star, CreditCard, ChevronRight, Lock, MapPin, Sparkles, AlertOctagon, HeartHandshake, Eye,
  Search, X, CheckCircle2, Wallet, RefreshCw, Zap, ArrowUpRight, Smartphone
} from 'lucide-react';

export const RiderApp: React.FC = () => {
  const { user, login, loginOtp, register, switchDemoUser } = useAuth();
  const { socket } = useSocket();

  // Navigation tabs: 'book' | 'pod' | 'trip' | 'history' | 'wallet' | 'safety'
  const [tab, setTab] = useState<'book' | 'pod' | 'trip' | 'history' | 'wallet' | 'safety'>('book');

  // Station and route selection
  const [stations, setStations] = useState<StationData[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('bata-chowk');
  const [stationDetails, setStationDetails] = useState<StationData | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<number>(1);
  const [selectedDropZoneId, setSelectedDropZoneId] = useState<string>('nit-faridabad-1-2');
  const [isWomenOnly, setIsWomenOnly] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  // Destination search & typing state
  const [destinationInput, setDestinationInput] = useState<string>('');
  const [selectedDestination, setSelectedDestination] = useState<{
    id?: string;
    name: string;
    lat: number;
    lng: number;
    distanceKm: number;
    podFare: number;
    soloFare: number;
    isCustom?: boolean;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [activePodsForStation, setActivePodsForStation] = useState<any[]>([]);

  // Active Pod and Ride states
  const [activePod, setActivePod] = useState<RidePod | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);

  // Modals & Safety
  const [showHazardModal, setShowHazardModal] = useState(false);
  const [hazardCategory, setHazardCategory] = useState<'broken_streetlight' | 'waterlogged_underpass' | 'isolated_dark_stretch' | 'harassment_stray_alert'>('broken_streetlight');
  const [hazardTitle, setHazardTitle] = useState('');
  const [hazardDesc, setHazardDesc] = useState('');
  const [hazardNotice, setHazardNotice] = useState('');

  // Rating & Online Payment
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(250);
  const [isRecharging, setIsRecharging] = useState<boolean>(false);

  // Corridor safety score
  const [safetyInfo, setSafetyInfo] = useState<{ level: 'green' | 'amber' | 'red'; label: string; score: number }>({
    level: 'green',
    label: 'Well-Lit Safe Corridor',
    score: 95
  });

  // Auth form states if logged out
  const [authMode, setAuthMode] = useState<'password' | 'otp' | 'register'>('password');
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [emergencyPhoneInput, setEmergencyPhoneInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load stations on mount
  useEffect(() => {
    fetch('/api/rider/stations')
      .then(res => res.json())
      .then(data => setStations(data))
      .catch(() => {});
  }, []);

  // Load selected station details
  useEffect(() => {
    if (!selectedSlug) return;
    fetch(`/api/rider/station/${selectedSlug}`)
      .then(res => res.json())
      .then(data => {
        setStationDetails(data);
        if (data.gates?.length > 0) setSelectedGateId(data.gates[0].id);
        if (data.dropZones?.length > 0) {
          const defaultDrop = data.dropZones[0];
          setSelectedDropZoneId(defaultDrop.id);
          setSelectedDestination({
            id: defaultDrop.id,
            name: defaultDrop.name,
            lat: defaultDrop.coordinates.lat,
            lng: defaultDrop.coordinates.lng,
            distanceKm: defaultDrop.distanceKm || 2.5,
            podFare: defaultDrop.typicalPodFare || 25,
            soloFare: defaultDrop.typicalSoloFare || 70,
            isCustom: false
          });
          setDestinationInput(defaultDrop.name);
        }

        // Evaluate corridor safety
        const hazardsCount = data.hazards?.length || 0;
        if (hazardsCount === 0) {
          setSafetyInfo({ level: 'green', label: 'Well-Lit Corridor (No hazards reported)', score: 95 });
        } else if (hazardsCount <= 2) {
          setSafetyInfo({ level: 'amber', label: 'Caution Advised (2 hazards nearby)', score: 70 });
        } else {
          setSafetyInfo({ level: 'red', label: 'High Hazard Alert (Multiple dark spots)', score: 45 });
        }
      })
      .catch(() => {});
  }, [selectedSlug]);

  // Fetch active forming pods for the selected station / destination
  useEffect(() => {
    if (!selectedSlug) return;
    const dest = selectedDestination?.name || '';
    fetch(`/api/rider/pods/active?stationSlug=${selectedSlug}&destination=${encodeURIComponent(dest)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setActivePodsForStation(data);
      })
      .catch(() => {});
  }, [selectedSlug, selectedDestination]);

  // Autocomplete search as rider types destination
  useEffect(() => {
    if (!destinationInput || destinationInput.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/rider/destinations/search?q=${encodeURIComponent(destinationInput)}&stationSlug=${selectedSlug}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSuggestions(data);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [destinationInput, selectedSlug]);

  // Load active ride or history if user is logged in
  useEffect(() => {
    if (!user || user.role !== 'rider') return;

    fetch('/api/rider/rides/current', {
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ride) {
          setActiveRide(data.ride);
          setTab('trip');
        }
      })
      .catch(() => {});

    fetch('/api/rider/rides/history', {
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    })
      .then(res => res.json())
      .then(data => setHistory(data))
      .catch(() => {});

    fetch('/api/rider/wallet', {
      headers: { Authorization: `Bearer ${localStorage.getItem('violetlink_token')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (typeof data.balance === 'number') setWalletBalance(data.balance);
      })
      .catch(() => {});
  }, [user]);

  // Socket event subscriptions
  useEffect(() => {
    if (!socket) return;

    socket.on('driver:location_update', (d: any) => {
      setNearbyDrivers(prev => {
        const idx = prev.findIndex(item => item.id === d.driverId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lat: d.lat, lng: d.lng };
          return updated;
        }
        return [...prev, { id: d.driverId, lat: d.lat, lng: d.lng }];
      });
    });

    socket.on('trip:driver_location', (data: any) => {
      setActiveRide(prev => prev && prev.id === data.rideId ? { ...prev, driver_lat: data.lat, driver_lng: data.lng } : prev);
    });

    socket.on('ride:accepted', (ride: Ride) => {
      if (activeRide && activeRide.id === ride.id) {
        setActiveRide(ride);
      }
    });

    socket.on('ride:status_changed', (data: { status: any }) => {
      setActiveRide(prev => {
        if (!prev) return null;
        if (data.status === 'completed') {
          setShowRatingModal(true);
        }
        return { ...prev, status: data.status };
      });
    });

    socket.on('pod:updated', (pod: RidePod) => {
      if (activePod && activePod.id === pod.id) {
        setActivePod(pod);
      }
    });

    socket.on('pod:locked', (data: { podId: string }) => {
      if (activePod && activePod.id === data.podId) {
        setActivePod(prev => prev ? { ...prev, status: 'locked' } : null);
      }
    });

    socket.on('pod:assigned', (data: { podId: string; rideId: string }) => {
      if (activePod && activePod.id === data.podId) {
        // Fetch new assigned ride details
        fetch(`/api/rider/rides/${data.rideId}`)
          .then(res => res.json())
          .then(r => {
            setActiveRide(r);
            setTab('trip');
          });
      }
    });

    socket.on('payment:confirmed', (data: any) => {
      setActiveRide(prev => prev && prev.id === data.rideId ? {
        ...prev,
        payment_status: 'confirmed',
        payment_method: 'razorpay'
      } : prev);
      if (typeof data.newBalance === 'number') {
        setWalletBalance(data.newBalance);
      }
    });

    return () => {
      socket.off('driver:location_update');
      socket.off('trip:driver_location');
      socket.off('ride:accepted');
      socket.off('ride:status_changed');
      socket.off('pod:updated');
      socket.off('pod:locked');
      socket.off('pod:assigned');
      socket.off('payment:confirmed');
    };
  }, [socket, activeRide, activePod]);

  // Handle destination selection from suggestions or manual input
  const handleSelectDestination = (dest: {
    id?: string;
    name: string;
    lat?: number;
    lng?: number;
    coordinates?: { lat: number; lng: number };
    distanceKm?: number;
    podFare?: number;
    soloFare?: number;
    typicalPodFare?: number;
    typicalSoloFare?: number;
    isCustom?: boolean;
  }) => {
    const defaultLat = stationCenter[0] + 0.012;
    const defaultLng = stationCenter[1] + 0.012;
    const lat = dest.lat ?? dest.coordinates?.lat ?? defaultLat;
    const lng = dest.lng ?? dest.coordinates?.lng ?? defaultLng;
    const dist = dest.distanceKm ?? 2.5;
    const podFare = dest.podFare ?? dest.typicalPodFare ?? Math.max(15, Math.round(10 + dist * 5));
    const soloFare = dest.soloFare ?? dest.typicalSoloFare ?? Math.max(45, Math.round(30 + dist * 12));

    setSelectedDestination({
      id: dest.id || 'custom',
      name: dest.name,
      lat,
      lng,
      distanceKm: dist,
      podFare,
      soloFare,
      isCustom: !!dest.isCustom
    });
    setSelectedDropZoneId(dest.id || 'custom');
    setDestinationInput(dest.name);
    setShowSuggestions(false);
  };

  // Request Solo Ride
  const handleRequestSolo = async () => {
    if (!stationDetails) return;
    const gate = stationDetails.gates.find(g => g.id === selectedGateId) || stationDetails.gates[0];
    const destName = selectedDestination?.name || destinationInput || 'NIT Faridabad';
    const dropLat = selectedDestination?.lat || (stationCenter[0] + 0.015);
    const dropLng = selectedDestination?.lng || (stationCenter[1] + 0.015);
    const fare = selectedDestination?.soloFare || 70;

    const res = await fetch('/api/rider/rides/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({
        stationSlug: selectedSlug,
        gateId: gate.id,
        dropZoneId: selectedDestination?.id || selectedDropZoneId || 'custom',
        dropAddress: destName,
        dropLat,
        dropLng,
        pickupLat: gate.coordinates.lat,
        pickupLng: gate.coordinates.lng,
        fare,
        isWomenOnly
      })
    });

    if (res.ok) {
      const data = await res.json();
      setActiveRide({
        id: data.rideId,
        type: 'solo',
        rider_id: user!.id,
        station_slug: selectedSlug,
        gate_id: gate.id,
        drop_address: destName,
        drop_lat: dropLat,
        drop_lng: dropLng,
        pickup_lat: gate.coordinates.lat,
        pickup_lng: gate.coordinates.lng,
        fare: data.fare,
        status: 'searching',
        start_otp: data.otp,
        payment_method: 'cash',
        payment_status: 'pending',
        created_at: new Date().toISOString()
      });
      setTab('trip');
    }
  };

  // Join Ride Pod
  const handleJoinPod = async (overrideParams?: { destinationName?: string; dropLat?: number; dropLng?: number; seatFare?: number }) => {
    if (!stationDetails) return;
    const gate = stationDetails.gates.find(g => g.id === selectedGateId) || stationDetails.gates[0];
    const destName = overrideParams?.destinationName || selectedDestination?.name || destinationInput || 'NIT Faridabad';
    const dropLat = overrideParams?.dropLat || selectedDestination?.lat || (stationCenter[0] + 0.015);
    const dropLng = overrideParams?.dropLng || selectedDestination?.lng || (stationCenter[1] + 0.015);
    const seatFare = overrideParams?.seatFare || selectedDestination?.podFare || 25;

    const res = await fetch('/api/rider/pods/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({
        stationSlug: selectedSlug,
        exitGateId: gate.id,
        dropZoneId: selectedDestination?.id || selectedDropZoneId || 'custom',
        destinationName: destName,
        dropLat,
        dropLng,
        direction: 'towards_raja_nahar_singh',
        isWomenOnly,
        seatFare
      })
    });

    if (res.ok) {
      const data = await res.json();
      setActivePod(data.pod);
      setTab('pod');
    }
  };

  // Cancel current ride
  const handleCancelRide = async () => {
    if (!activeRide) return;
    const res = await fetch(`/api/rider/rides/${activeRide.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({ reason: 'Commuter requested cancellation' })
    });
    if (res.ok) {
      setActiveRide(null);
      setTab('book');
    }
  };

  // Pay via Razorpay / Mock
  const handlePayment = async () => {
    if (!activeRide) return;
    setIsProcessingPayment(true);

    try {
      // 1. Create order
      const orderRes = await fetch('/api/rider/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
        },
        body: JSON.stringify({ rideId: activeRide.id, amount: activeRide.fare })
      });
      const order = await orderRes.json();

      // In mock mode or browser without Razorpay
      if (order.isMock || !(window as any).Razorpay) {
        // Direct mock confirmation
        const verifyRes = await fetch('/api/rider/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
          },
          body: JSON.stringify({
            rideId: activeRide.id,
            razorpayOrderId: order.orderId,
            razorpayPaymentId: `pay_mock_${Date.now()}`,
            razorpaySignature: 'mock_valid_signature',
            isMock: true
          })
        });
        if (verifyRes.ok) {
          setActiveRide(prev => prev ? { ...prev, payment_status: 'confirmed', payment_method: 'razorpay' } : null);
        }
      } else {
        // Open standard Razorpay Checkout modal
        const options = {
          key: order.keyId,
          amount: order.amountPaisa,
          currency: 'INR',
          name: 'VioletLink Last-Mile',
          description: `Ride payment - ${activeRide.station_slug}`,
          order_id: order.orderId,
          handler: async (response: any) => {
            await fetch('/api/rider/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
              },
              body: JSON.stringify({
                rideId: activeRide.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                isMock: false
              })
            });
            setActiveRide(prev => prev ? { ...prev, payment_status: 'confirmed' } : null);
          }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      console.error('Payment error:', err);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Submit Driver Rating
  const handleSubmitRating = async () => {
    if (!activeRide) return;
    await fetch(`/api/rider/rides/${activeRide.id}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({ stars: ratingStars })
    });
    setShowRatingModal(false);
    setActiveRide(null);
    setTab('book');
  };

  // Report Citizen Hazard
  const handleReportHazard = async () => {
    if (!stationDetails || !hazardTitle) return;
    const gate = stationDetails.gates.find(g => g.id === selectedGateId) || stationDetails.gates[0];

    const res = await fetch('/api/rider/hazards/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
      },
      body: JSON.stringify({
        stationSlug: selectedSlug,
        category: hazardCategory,
        title: hazardTitle,
        description: hazardDesc,
        lat: gate.coordinates.lat + (Math.random() - 0.5) * 0.002,
        lng: gate.coordinates.lng + (Math.random() - 0.5) * 0.002
      })
    });

    const data = await res.json();
    setHazardNotice(data.message || 'Report submitted successfully!');
    setTimeout(() => {
      setHazardNotice('');
      setShowHazardModal(false);
      setHazardTitle('');
      setHazardDesc('');
    }, 2000);
  };

  // Trigger Emergency SOS (112 Dialer + WhatsApp emergency link)
  const triggerSOS = () => {
    const contactPhone = user?.emergencyContactPhone || '9876500001';
    const message = encodeURIComponent(
      `🚨 EMERGENCY SOS ALERT! I am a commuter on DMRC Violet Line near ${stationDetails?.name || 'Faridabad Metro'}. Tracking: ${window.location.origin}/rider`
    );
    window.open(`https://wa.me/91${contactPhone}?text=${message}`, '_blank');
    window.location.href = 'tel:112';
  };

  // If user is not logged in as rider, show mobile-friendly login/signup screen
  if (!user || user.role !== 'rider') {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-gradient-to-b from-violet-50 via-white to-slate-50 px-5 py-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md">
              V
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-xl tracking-tight">VioletLink</h1>
              <p className="text-xs font-semibold text-violet-600">DMRC Violet Line Commuter Portal</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xl border border-violet-100 mb-5">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-2xl mb-4 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setAuthError(''); setAuthSuccess(''); }}
                className={`py-2 rounded-xl transition ${authMode === 'password' ? 'bg-white text-violet-700 shadow-sm font-black' : 'hover:text-slate-900'}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setAuthError(''); setAuthSuccess(''); }}
                className={`py-2 rounded-xl transition ${authMode === 'otp' ? 'bg-white text-violet-700 shadow-sm font-black' : 'hover:text-slate-900'}`}
              >
                OTP Login
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
                className={`py-2 rounded-xl transition ${authMode === 'register' ? 'bg-white text-violet-700 shadow-sm font-black' : 'hover:text-slate-900'}`}
              >
                Sign Up
              </button>
            </div>

            {/* Error & Success Banners */}
            {authError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-start gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <div>{authError}</div>
              </div>
            )}
            {authSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold animate-fadeIn">
                {authSuccess}
              </div>
            )}

            {/* TAB 1: PASSWORD LOGIN */}
            {authMode === 'password' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setAuthError('');
                    setIsSubmitting(true);
                    await login(phoneInput, passwordInput, 'rider');
                  } catch (err: any) {
                    setAuthError(err.message || 'Login failed. Please check your credentials.');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number or Email</label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                    placeholder="e.g. 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                    placeholder="Enter your password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? 'Logging in...' : 'Log In as Commuter'}
                </button>
              </form>
            )}

            {/* TAB 2: OTP LOGIN (Passwordless) */}
            {authMode === 'otp' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setAuthError('');
                    setIsSubmitting(true);
                    if (!otpSent) {
                      // Step 1: Send OTP
                      const res = await fetch('/api/auth/send-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: phoneInput })
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
                      setOtpSent(true);
                      setAuthSuccess(`Verification code sent! (Mock test code: 1234)`);
                    } else {
                      // Step 2: Verify & Login
                      await loginOtp(phoneInput, otpInput, 'rider');
                    }
                  } catch (err: any) {
                    setAuthError(err.message || 'OTP verification failed');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => { setPhoneInput(e.target.value); setOtpSent(false); }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                    placeholder="10-digit mobile number"
                  />
                </div>

                {otpSent && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Enter 4-Digit OTP</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full text-center text-3xl font-mono font-black tracking-widest py-2 rounded-xl border-2 border-violet-500 outline-none"
                      placeholder="••••"
                    />
                    <div className="text-[11px] text-slate-400 mt-1 text-center font-medium">
                      Tip: Enter demo code <span className="font-bold text-violet-600 font-mono">1234</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? 'Please wait...' : !otpSent ? 'Send OTP Code' : 'Verify & Enter'}
                </button>
              </form>
            )}

            {/* TAB 3: REGISTER NEW ACCOUNT */}
            {authMode === 'register' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setAuthError('');
                    setIsSubmitting(true);
                    await register({
                      name: nameInput,
                      phone: phoneInput,
                      password: passwordInput,
                      role: 'rider',
                      emergencyName: 'Emergency Contact',
                      emergencyPhone: emergencyPhoneInput
                    });
                  } catch (err: any) {
                    setAuthError(err.message || 'Registration failed');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                    placeholder="e.g. Ananya Singh"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                    placeholder="10-digit phone"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Create Password</label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                    placeholder="At least 4 characters"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Contact Mobile (Optional)</label>
                  <input
                    type="tel"
                    value={emergencyPhoneInput}
                    onChange={e => setEmergencyPhoneInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-violet-500 outline-none font-mono"
                    placeholder="For SOS quick alert"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-200 transition active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating account...' : 'Create Rider Account'}
                </button>
              </form>
            )}

            {/* Quick Demo Helper Button */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('password');
                  setPhoneInput('9876543210');
                  setPasswordInput('password123');
                  setAuthError('');
                  setAuthSuccess('Demo credentials populated for Pooja Sharma.');
                }}
                className="text-violet-600 font-bold hover:underline"
              >
                ⚡ Auto-fill Pooja Sharma (Demo)
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400 mt-4">
          VioletLink &bull; Open Source Metro Transit &bull; MIT License
        </div>
      </div>
    );
  }

  // Selected station coordinates
  const stationCenter: [number, number] = stationDetails
    ? [stationDetails.coordinates.lat, stationDetails.coordinates.lng]
    : [28.3789, 77.3142];

  const selectedDrop = stationDetails?.dropZones.find(d => d.id === selectedDropZoneId);
  const dropCoords: [number, number] | null = selectedDestination
    ? [selectedDestination.lat, selectedDestination.lng]
    : selectedDrop
    ? [selectedDrop.coordinates.lat, selectedDrop.coordinates.lng]
    : null;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-24 relative">
      {/* Top Header Card */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase font-extrabold text-violet-600 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> DMRC Violet Line Faridabad
          </div>
          <select
            value={selectedSlug}
            onChange={e => setSelectedSlug(e.target.value)}
            className="text-sm font-extrabold text-slate-900 bg-transparent outline-none cursor-pointer"
          >
            {stations.map(s => (
              <option key={s.slug} value={s.slug}>
                {s.name} ({s.hindiName})
              </option>
            ))}
          </select>
        </div>

        {/* SOS Button */}
        <button
          onClick={triggerSOS}
          className="px-2.5 py-1.5 bg-rose-600 text-white rounded-xl font-extrabold text-xs flex items-center gap-1 shadow-md shadow-rose-200 active:scale-95 animate-pulse"
        >
          <AlertOctagon className="w-3.5 h-3.5" /> SOS 112
        </button>
      </div>

      {/* Main Viewport */}
      {tab === 'book' && (
        <div className="flex-1 flex flex-col">
          {/* Map Preview (240px) */}
          <div className="h-60 w-full relative">
            <MapComponent
              center={stationCenter}
              zoom={15}
              gates={stationDetails?.gates || []}
              autoStands={stationDetails?.autoStands || []}
              drivers={nearbyDrivers}
              hazards={stationDetails?.hazards || []}
              dropPoint={dropCoords}
              corridorSafetyLevel={safetyInfo.level}
            />

            {/* Corridor Safety Pill Overlay */}
            <div className="absolute top-2 left-2 right-2 z-20 pointer-events-none flex justify-center">
              <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1.5 backdrop-blur-md ${
                safetyInfo.level === 'green'
                  ? 'bg-emerald-500/95 text-white'
                  : safetyInfo.level === 'amber'
                  ? 'bg-amber-500/95 text-slate-950'
                  : 'bg-rose-600/95 text-white'
              }`}>
                <Shield className="w-3.5 h-3.5" />
                <span>{safetyInfo.label}</span>
              </div>
            </div>

            {/* Report Hazard Floating Button */}
            <button
              onClick={() => setShowHazardModal(true)}
              className="absolute bottom-2 right-2 z-20 bg-slate-900/90 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl shadow-lg flex items-center gap-1 hover:bg-slate-900"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Report Hazard
            </button>
          </div>

          {/* Booking Options Container */}
          <div className="p-4 space-y-3.5 flex-1">
            {/* Gate Selector */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm">
              <label className="text-xs font-bold text-slate-700 block mb-2">Select Metro Exit Gate</label>
              <div className="grid grid-cols-2 gap-2">
                {stationDetails?.gates.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGateId(g.id)}
                    className={`p-2.5 rounded-xl text-left border transition ${
                      selectedGateId === g.id
                        ? 'border-violet-600 bg-violet-50 text-violet-950 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs">Gate {g.id}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">{g.landmarks}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Destination Search & Auto-complete */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm relative">
              <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Where do you want to go?</span>
                <span className="text-[10px] text-violet-600 font-semibold">Type area or choose below</span>
              </label>

              {/* Search Bar Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4 text-violet-600" />
                </div>
                <input
                  type="text"
                  value={destinationInput}
                  onChange={e => {
                    setDestinationInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Type any Sector, Market, College or Landmark..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
                />
                {destinationInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationInput('');
                      setShowSuggestions(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showSuggestions && (
                <div className="absolute left-3.5 right-3.5 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-2xl border border-violet-100 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                  {/* Option 1: Confirm Custom Typed Destination */}
                  {destinationInput.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectDestination({
                          id: 'custom',
                          name: destinationInput.trim(),
                          distanceKm: 3.0,
                          podFare: 25,
                          soloFare: 70,
                          isCustom: true
                        });
                      }}
                      className="w-full text-left p-3 hover:bg-violet-50 flex items-start gap-2.5 transition bg-violet-50/50"
                    >
                      <MapPin className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-black text-violet-900">
                          Set Destination: "{destinationInput.trim()}"
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Fellow commuters heading to this area will match into your pod
                        </div>
                      </div>
                      <span className="text-xs font-black text-violet-700 bg-violet-100 px-2 py-0.5 rounded-lg">
                        ₹25 Pod
                      </span>
                    </button>
                  )}

                  {/* Option 2: Filtered Suggestions */}
                  {suggestions.map((item, idx) => (
                    <button
                      key={item.id || idx}
                      type="button"
                      onClick={() => handleSelectDestination(item)}
                      className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center justify-between transition"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.area} &bull; {item.distanceKm} km</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-violet-700">₹{item.podFare} <span className="text-[10px] font-normal text-slate-400">Pod</span></div>
                        <div className="text-[9px] text-slate-400">Solo ₹{item.soloFare}</div>
                      </div>
                    </button>
                  ))}

                  {suggestions.length === 0 && !destinationInput.trim() && (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Type a destination or pick from quick chips below
                    </div>
                  )}
                </div>
              )}

              {/* Quick Area Chips */}
              <div className="mt-2.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Popular Last-Mile Destinations
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Sector 15', name: 'Sector 15 Market', dist: 2.2, pod: 20, solo: 60 },
                    { label: 'NIT Faridabad', name: 'NIT Faridabad Market (1-2-3)', dist: 2.5, pod: 25, solo: 70 },
                    { label: 'World Street', name: 'Omaxe World Street Neharpar', dist: 5.5, pod: 40, solo: 100 },
                    { label: 'Sector 16', name: 'Sector 16 Commercial Hub', dist: 2.8, pod: 25, solo: 70 },
                    { label: 'Manav Rachna', name: 'Manav Rachna Campus (MRIIRS)', dist: 5.0, pod: 35, solo: 95 },
                    { label: 'Sector 12', name: 'Sector 12 Court & City Mall', dist: 1.8, pod: 20, solo: 55 }
                  ].map(chip => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        handleSelectDestination({
                          id: `chip-${chip.label.toLowerCase().replace(/\s+/g, '-')}`,
                          name: chip.name,
                          distanceKm: chip.dist,
                          podFare: chip.pod,
                          soloFare: chip.solo,
                          isCustom: false
                        });
                      }}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                        selectedDestination?.name?.includes(chip.label)
                          ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Destination Summary Card */}
              {selectedDestination && (
                <div className="mt-3 p-2.5 bg-violet-50/70 border border-violet-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-600 animate-pulse" />
                    <div>
                      <div className="text-xs font-black text-violet-950">
                        Drop: {selectedDestination.name}
                      </div>
                      <div className="text-[10px] text-violet-700">
                        {selectedDestination.distanceKm} km from Gate {selectedGateId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-violet-800">
                      ₹{selectedDestination.podFare} <span className="text-[10px] font-medium text-slate-500">/ seat</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold">
                      Solo ₹{selectedDestination.soloFare}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Forming Pods for this Destination or Station */}
            {activePodsForStation.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-2xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Live Pods Forming Now ({activePodsForStation.length})</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Same destination
                  </span>
                </div>
                <div className="space-y-1.5">
                  {activePodsForStation.slice(0, 2).map((pod: any) => (
                    <div
                      key={pod.id}
                      className="p-2.5 bg-white rounded-xl border border-emerald-100 flex items-center justify-between shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-md flex-shrink-0 shadow-xs"
                          style={{ backgroundColor: pod.pod_color || '#10B981' }}
                        />
                        <div>
                          <div className="font-extrabold text-xs text-slate-900">
                            {pod.pod_code} &rarr; {pod.destination_name || 'Area Drop'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Gate {pod.exit_gate_id} &bull; <strong className="text-emerald-700">{pod.member_count || 1}/{pod.max_seats || 4} riders</strong> heading here
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleJoinPod({
                            destinationName: pod.destination_name,
                            dropLat: pod.drop_lat,
                            dropLng: pod.drop_lng,
                            seatFare: pod.seat_fare
                          });
                        }}
                        className="text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1"
                      >
                        Join ₹{pod.seat_fare}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Women-Only Pod Toggle */}
            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-200 text-violet-700 rounded-lg">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Women-Only Pod</div>
                  <div className="text-[10px] text-slate-500">Match exclusively with female co-passengers</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isWomenOnly}
                onChange={e => setIsWomenOnly(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </div>

            {/* Action Buttons: Join Pod vs Book Solo */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => handleJoinPod()}
                className="py-3 px-3 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-2xl shadow-lg shadow-violet-200 flex flex-col items-center justify-center transition active:scale-95"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Users className="w-4 h-4" /> Join Ride Pod
                </div>
                <div className="text-[11px] font-normal text-violet-200 mt-0.5">
                  ₹{selectedDestination?.podFare || 25}/seat fixed
                </div>
              </button>

              <button
                onClick={handleRequestSolo}
                className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl shadow-lg flex flex-col items-center justify-center transition active:scale-95"
              >
                <div className="flex items-center gap-1 text-xs">
                  <Navigation className="w-4 h-4" /> Book Solo Auto
                </div>
                <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                  ₹{selectedDestination?.soloFare || 70} reserve
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature A: High-Contrast Ride Pod View */}
      {tab === 'pod' && activePod && (
        <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Visual Pod Badge (High Contrast Color + Shape + Number) */}
            <div
              className="rounded-3xl p-6 text-white text-center shadow-2xl relative overflow-hidden"
              style={{ backgroundColor: activePod.pod_color || '#10B981' }}
            >
              <div className="text-xs uppercase font-extrabold tracking-widest opacity-80 mb-1">
                {activePod.pod_shape}
              </div>
              <h2 className="text-3xl font-black tracking-tight">{activePod.pod_code}</h2>
              <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 bg-black/25 backdrop-blur-sm rounded-full text-xs font-bold">
                <span>Gate {activePod.exit_gate_id}</span> &bull; <span>📍 {activePod.destination_name || 'Shared Drop Zone'}</span> &bull; <span>₹{activePod.seat_fare} / seat</span>
              </div>

              {activePod.is_women_only === 1 && (
                <div className="mt-2 text-[11px] font-extrabold bg-white/20 py-0.5 px-2 rounded-full inline-block">
                  🌸 Women-Only Pod
                </div>
              )}
            </div>

            {/* Pod Status Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pod Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold capitalize ${
                  activePod.status === 'forming'
                    ? 'bg-amber-100 text-amber-800'
                    : activePod.status === 'locked'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {activePod.status}
                </span>
              </div>

              <div className="text-xs text-slate-600">
                {activePod.status === 'forming' && (
                  <p>Grouping with fellow commuters heading to <strong className="text-violet-900">{activePod.destination_name || 'this area'}</strong>. Locks automatically 3 minutes before arrival at {stationDetails?.name}.</p>
                )}
                {activePod.status === 'locked' && (
                  <p className="font-semibold text-blue-700">Pod locked for {activePod.destination_name}! Offered to approved drivers at Gate {activePod.exit_gate_id}.</p>
                )}
                {activePod.status === 'assigned' && (
                  <p className="font-semibold text-emerald-700">Driver assigned! Meet at Gate {activePod.exit_gate_id} auto stand for ride to {activePod.destination_name}.</p>
                )}
              </div>

              {/* Members (Privacy Preserved: First names only, zero phone numbers) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                  <span>Co-Passengers ({activePod.members?.length || 1}/{activePod.max_seats})</span>
                  <span className="text-[11px] text-slate-400 font-normal">No phone numbers shared</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activePod.members?.map(m => (
                    <div key={m.id} className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-800 flex items-center gap-1.5 border border-slate-200">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      {m.rider_first_name}
                    </div>
                  ))}
                  {Array.from({ length: activePod.max_seats - (activePod.members?.length || 1) }).map((_, i) => (
                    <div key={i} className="px-3 py-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-400">
                      Waiting seat...
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* In-Train Fast Forward Demo Trigger */}
            <div className="bg-violet-50 rounded-2xl p-3.5 border border-violet-200 text-xs flex items-center justify-between">
              <div>
                <div className="font-bold text-violet-900">Demo Simulator Active</div>
                <div className="text-[10px] text-violet-600">Use bar at bottom to add riders or speed up train</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setTab('book')}
            className="w-full py-3 bg-slate-200 text-slate-800 font-bold rounded-2xl hover:bg-slate-300"
          >
            Back to Station Map
          </button>
        </div>
      )}

      {/* Feature B: Live Trip Screen */}
      {tab === 'trip' && activeRide && (
        <div className="p-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Live Map with Driver Marker */}
            <div className="h-56 w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
              <MapComponent
                center={[activeRide.pickup_lat, activeRide.pickup_lng]}
                zoom={16}
                drivers={activeRide.driver_lat && activeRide.driver_lng ? [{
                  id: activeRide.driver_id || 'active',
                  lat: activeRide.driver_lat,
                  lng: activeRide.driver_lng,
                  vehicleType: activeRide.vehicle_type,
                  name: activeRide.driver_name
                }] : []}
                dropPoint={[activeRide.drop_lat, activeRide.drop_lng]}
                routePolyline={[[activeRide.pickup_lat, activeRide.pickup_lng], [activeRide.drop_lat, activeRide.drop_lng]]}
              />
            </div>

            {/* OTP Start Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-center">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Give OTP to Driver to Start Ride
              </div>
              <div className="text-4xl font-black text-violet-700 font-mono tracking-widest my-1">
                {activeRide.start_otp}
              </div>
              <div className="text-[11px] text-slate-400">
                Driver cannot start the meter or trip without this 4-digit code.
              </div>
            </div>

            {/* Driver Profile Card */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={activeRide.driver_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt="Driver"
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm"
                  />
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{activeRide.driver_name || 'Searching for driver...'}</h3>
                    <div className="text-xs font-mono font-bold text-violet-700">{activeRide.vehicle_number || 'Auto DL1R-XXXX'}</div>
                    <div className="flex items-center gap-1 text-[11px] text-amber-500 font-bold">
                      <Star className="w-3 h-3 fill-current" /> {activeRide.driver_rating || 4.9}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-500">Trip Fare</div>
                  <div className="text-xl font-black text-slate-900">₹{activeRide.fare}</div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize ${
                    activeRide.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeRide.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Share Live Trip & Safety Action */}
              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/rider?ride_id=${activeRide.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert(`✅ Public trip tracking link copied to clipboard:\n${shareUrl}\n(No login required, auto-expires on completion)`);
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Trip Link
                </button>

                {activeRide.payment_status !== 'confirmed' ? (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-violet-200 transition active:scale-95"
                  >
                    <CreditCard className="w-3.5 h-3.5" /> Pay Online (UPI / Card / Wallet)
                  </button>
                ) : (
                  <div className="flex-1 py-2.5 bg-emerald-50 text-emerald-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 border border-emerald-200 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ✓ Paid Online (₹{activeRide.fare})
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeRide.status === 'searching' && (
            <button
              onClick={handleCancelRide}
              className="w-full py-3 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold rounded-2xl transition"
            >
              Cancel Ride (Free within 1 min)
            </button>
          )}
        </div>
      )}

      {/* Trip History View */}
      {tab === 'history' && (
        <div className="p-4 space-y-3 flex-1 pb-20">
          <h2 className="text-base font-extrabold text-slate-900">Your Trip History</h2>
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">No completed trips yet.</div>
          ) : (
            history.map(h => (
              <div key={h.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-900">{h.station_slug.toUpperCase()} &rarr; {h.drop_address}</span>
                  <span className="font-black text-slate-900">₹{h.fare}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Driver: {h.driver_name || 'Assigned Driver'} ({h.vehicle_number || 'Auto'})</span>
                  <span className="capitalize">{h.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Wallet & Online Payments View */}
      {tab === 'wallet' && (
        <div className="p-4 space-y-4 flex-1 pb-20 animate-fadeIn">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Metro Smart Wallet</h2>
            <p className="text-xs text-slate-500">1-Tap digital contactless pay for DMRC last-mile rides</p>
          </div>

          {/* Visual Digital Metro Card */}
          <div className="bg-gradient-to-br from-violet-700 via-indigo-800 to-purple-900 rounded-3xl p-5 text-white shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] uppercase font-black tracking-widest text-violet-300">
                  DMRC VioletLine Metro Card
                </div>
                <div className="text-xs font-bold text-white/80 mt-0.5">Commuter Pass</div>
              </div>
              <div className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-extrabold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" /> Auto-Reload Active
              </div>
            </div>

            <div className="my-5">
              <div className="text-xs text-violet-200 font-medium">Available Balance</div>
              <div className="text-3xl font-black tracking-tight mt-0.5">₹{walletBalance.toFixed(2)}</div>
            </div>

            <div className="flex justify-between items-end text-xs font-mono">
              <div className="text-white/80 text-[11px] font-sans font-bold">
                {user?.name || 'Commuter'}
              </div>
              <div className="text-violet-300 text-[10px]">FARIDABAD METRO TRANSIT</div>
            </div>
          </div>

          {/* Quick Recharge Chips */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-violet-600" /> Instant Wallet Top-Up
              </span>
              <span className="text-[10px] text-emerald-600 font-extrabold">Instant &bull; Zero Fees</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[100, 200, 500].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={async () => {
                    setIsRecharging(true);
                    try {
                      const res = await fetch('/api/rider/wallet/topup', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${localStorage.getItem('violetlink_token')}`
                        },
                        body: JSON.stringify({ amount: amt })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setWalletBalance(data.balance);
                        alert(`✅ ₹${amt} added successfully! New Wallet Balance: ₹${data.balance}`);
                      }
                    } finally {
                      setIsRecharging(false);
                    }
                  }}
                  disabled={isRecharging}
                  className="py-3 rounded-xl border border-violet-200 hover:border-violet-600 bg-violet-50/50 hover:bg-violet-100/80 text-violet-900 font-extrabold text-sm transition active:scale-95 disabled:opacity-50"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Supported Online Payment Options */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
            <div className="text-xs font-bold text-slate-700">Supported Online Payment Methods</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-violet-600" />
                  <div>
                    <div className="font-bold text-slate-800">UPI Instant Apps</div>
                    <div className="text-[10px] text-slate-500">Google Pay, PhonePe, Paytm, BHIM</div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-violet-600" />
                  <div>
                    <div className="font-bold text-slate-800">Razorpay Gateway</div>
                    <div className="text-[10px] text-slate-500">Debit / Credit Cards & NetBanking</div>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety & Citizen Hazard Corridor View */}
      {tab === 'safety' && (
        <div className="p-4 space-y-4 flex-1 pb-20 animate-fadeIn">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Safe-Walk & Citizen Safety</h2>
            <p className="text-xs text-slate-500">Real-time corridor lighting, pedestrian safety and quick SOS</p>
          </div>

          {/* Safe Corridor Score Card */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-2xl ${
                  safetyInfo.level === 'green' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-black text-sm text-slate-900">{safetyInfo.label}</div>
                  <div className="text-[10px] text-slate-500">{stationDetails?.name} Corridor Rating: {safetyInfo.score}/100</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                  {safetyInfo.score}% Safe
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Corridors are monitored based on citizen reports of broken streetlights, waterlogging, and dark stretches within 500m of exit gates.
            </p>

            <button
              onClick={() => setShowHazardModal(true)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Report Hazard / Dark Spot
            </button>
          </div>

          {/* Emergency SOS Deep Link */}
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div>
                <div className="text-xs font-black text-rose-950">Emergency SOS Alert System</div>
                <div className="text-[10px] text-rose-700">One-tap connection to Police (112) and WhatsApp live location</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={triggerSOS}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-rose-200 flex items-center justify-center gap-1 transition active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" /> Dial 112
              </button>
              <button
                onClick={() => {
                  const contact = user?.emergencyContactPhone || '9876500001';
                  const msg = encodeURIComponent(`🚨 COMMUTER EMERGENCY! Tracking my journey from ${stationDetails?.name || 'Faridabad Metro'}`);
                  window.open(`https://wa.me/91${contact}?text=${msg}`, '_blank');
                }}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-200 flex items-center justify-center gap-1 transition active:scale-95"
              >
                WhatsApp SOS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom App Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-2xl px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setTab('book')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            tab === 'book' ? 'text-violet-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <MapPin className={`w-4 h-4 ${tab === 'book' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Book</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('pod')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition relative ${
            tab === 'pod' ? 'text-violet-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          {activePod && activePod.status === 'forming' && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-violet-600 animate-ping" />
          )}
          <Users className={`w-4 h-4 ${tab === 'pod' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Pods</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('trip')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition relative ${
            tab === 'trip' ? 'text-violet-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          {activeRide && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <Navigation className={`w-4 h-4 ${tab === 'trip' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Trip</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('wallet')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            tab === 'wallet' ? 'text-violet-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <Wallet className={`w-4 h-4 ${tab === 'wallet' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Wallet</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('safety')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
            tab === 'safety' ? 'text-violet-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
          }`}
        >
          <Shield className={`w-4 h-4 ${tab === 'safety' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] mt-0.5">Safety</span>
        </button>
      </div>

      {/* Online Payment Modal */}
      {activeRide && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          ride={activeRide}
          onPaymentSuccess={() => {
            setActiveRide(prev => prev ? { ...prev, payment_status: 'confirmed', payment_method: 'razorpay' } : null);
          }}
        />
      )}

      {/* Citizen Hazard Reporting Modal */}
      {showHazardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Report Last-Mile Hazard
              </h3>
              <button onClick={() => setShowHazardModal(false)} className="text-slate-400 font-bold">&times;</button>
            </div>

            {hazardNotice && (
              <div className="p-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl text-center border border-emerald-200">
                {hazardNotice}
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Hazard Category</label>
              <select
                value={hazardCategory}
                onChange={e => setHazardCategory(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
              >
                <option value="broken_streetlight">💡 Broken Streetlight</option>
                <option value="waterlogged_underpass">🌊 Waterlogged Underpass</option>
                <option value="isolated_dark_stretch">🌑 Isolated Dark Stretch</option>
                <option value="harassment_stray_alert">🚨 Harassment / Stray Animal Alert</option>
              </select>

              <label className="font-bold text-slate-700 block mt-2">Hazard Title</label>
              <input
                type="text"
                value={hazardTitle}
                onChange={e => setHazardTitle(e.target.value)}
                placeholder="e.g. Dark stretch behind Gate 2 stairs"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
              />

              <label className="font-bold text-slate-700 block mt-2">Details (Optional)</label>
              <textarea
                value={hazardDesc}
                onChange={e => setHazardDesc(e.target.value)}
                placeholder="Describe lighting or pedestrian risks..."
                rows={2}
                className="w-full p-2 rounded-xl border border-slate-300"
              />

              <p className="text-[10px] text-slate-400">
                Reports within 30m of existing hazards automatically merge as confirmation upvotes.
              </p>

              <button
                onClick={handleReportHazard}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow mt-2"
              >
                Submit Citizen Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-2xl">
            <h3 className="font-black text-lg text-slate-900">Ride Completed!</h3>
            <p className="text-xs text-slate-500">How was your journey with {activeRide?.driver_name || 'your driver'}?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingStars(star)}
                  className="p-1 text-amber-400 hover:scale-110 transition"
                >
                  <Star className={`w-7 h-7 ${star <= ratingStars ? 'fill-amber-400' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmitRating}
              className="w-full py-2.5 bg-violet-600 text-white font-bold rounded-xl shadow-lg shadow-violet-200"
            >
              Submit Rating
            </button>
          </div>
        </div>
      )}

      {/* Floating Train Clock Simulator Bar */}
      <SimulatorBar currentPodId={activePod?.id} />
    </div>
  );
};
