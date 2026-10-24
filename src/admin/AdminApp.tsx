// src/admin/AdminApp.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Check, X, AlertTriangle, Users, Car, Activity, Lock, RefreshCw } from 'lucide-react';

export const AdminApp: React.FC = () => {
  const { user, login, switchDemoUser } = useAuth();

  // Admin tabs: 'drivers' | 'live' | 'hazards' | 'users' | 'stats'
  const [tab, setTab] = useState<'drivers' | 'live' | 'hazards' | 'users' | 'stats'>('drivers');

  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverFilter, setDriverFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [liveData, setLiveData] = useState<{ rides: any[]; pods: any[] }>({ rides: [], pods: [] });
  const [hazards, setHazards] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Admin login states
  const [adminId, setAdminId] = useState('9999900001');
  const [adminPass, setAdminPass] = useState('password123');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    const token = localStorage.getItem('violetlink_token');
    if (!token) return;

    try {
      // Drivers
      const dUrl = driverFilter === 'all' ? '/api/admin/drivers' : `/api/admin/drivers?status=${driverFilter}`;
      const dRes = await fetch(dUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (dRes.ok) setDrivers(await dRes.json());

      // Live Rides & Pods
      const lRes = await fetch('/api/admin/rides/live', { headers: { Authorization: `Bearer ${token}` } });
      if (lRes.ok) setLiveData(await lRes.json());

      // Hazards
      const hRes = await fetch('/api/admin/hazards', { headers: { Authorization: `Bearer ${token}` } });
      if (hRes.ok) setHazards(await hRes.json());

      // Users
      const uRes = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      if (uRes.ok) setUsersList(await uRes.json());

      // Stats
      const sRes = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  useEffect(() => {
    if (user && user.role === 'admin') {
      loadData();
    }
  }, [user, driverFilter]);

  // Approve / Reject driver
  const handleUpdateDriverStatus = async (driverId: string, status: 'approved' | 'rejected') => {
    const token = localStorage.getItem('violetlink_token');
    const res = await fetch(`/api/admin/drivers/${driverId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      loadData();
    }
  };

  // Moderate hazard
  const handleModerateHazard = async (hazardId: string, status: 'active' | 'rejected' | 'resolved') => {
    const token = localStorage.getItem('violetlink_token');
    const res = await fetch(`/api/admin/hazards/${hazardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      loadData();
    }
  };

  // Ban / Unban user
  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    const token = localStorage.getItem('violetlink_token');
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ isBanned: !currentBanned })
    });
    if (res.ok) {
      loadData();
    }
  };

  // If not logged in as admin, show admin login screen
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-900 text-white p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold shadow-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">VioletLink Admin</h1>
              <p className="text-xs text-slate-400">Faridabad Transit Operations Central</p>
            </div>
          </div>

          <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-black text-white">Administrator Login</h2>

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
                  await login(adminId, adminPass, 'admin');
                } catch (err: any) {
                  setAuthError(err.message || 'Login failed. Invalid administrator credentials.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Admin ID / Mobile</label>
                <input
                  type="text"
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  placeholder="e.g. 9999900001"
                  required
                  className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Password</label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg active:scale-95 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying Credentials...' : 'Access Central Console'}
              </button>
            </form>
          </div>

          <div className="mt-4 p-3 bg-slate-800 border border-slate-700 rounded-2xl text-center">
            <span className="text-xs font-bold text-slate-400 block mb-1">⚡ Quick 1-Click Admin Access</span>
            <button
              onClick={() => switchDemoUser('admin')}
              className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-xl font-bold shadow hover:bg-indigo-500"
            >
              Log in as Central Transit Admin
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          Restricted Administrative Portal &bull; DMRC Violet Line
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen bg-slate-900 text-white flex flex-col pb-12">
      {/* Top Admin Header */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black">Admin Operations Control</h2>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry Connected
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Admin Navigation Pills */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex gap-1.5 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setTab('drivers')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${tab === 'drivers' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Drivers Approval
        </button>
        <button
          onClick={() => setTab('live')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${tab === 'live' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Live Dispatch
        </button>
        <button
          onClick={() => setTab('hazards')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${tab === 'hazards' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Hazard Queue
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${tab === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Users & Moderation
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition ${tab === 'stats' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          Analytics
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* TAB 1: DRIVERS APPROVAL */}
        {tab === 'drivers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-200">Driver Verification Queue</h3>
              <div className="flex gap-1 text-[11px]">
                {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDriverFilter(f)}
                    className={`px-2 py-0.5 rounded capitalize ${driverFilter === f ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 bg-slate-800'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {drivers.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">No drivers in this category.</div>
            ) : (
              drivers.map(d => (
                <div key={d.id} className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={d.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover border border-slate-600"
                    />
                    <div>
                      <div className="font-extrabold text-sm text-white">{d.name}</div>
                      <div className="text-xs font-mono text-amber-400">{d.vehicle_number} &bull; {d.vehicle_type}</div>
                      <div className="text-[11px] text-slate-400">
                        License: <span className="font-mono text-slate-300">{d.license_number}</span> &bull; {d.preferred_station_slug} (Gate {d.preferred_gate_id})
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold capitalize ${
                      d.status === 'approved' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      d.status === 'pending' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {d.status}
                    </span>

                    {d.status === 'pending' && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleUpdateDriverStatus(d.id, 'approved')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleUpdateDriverStatus(d.id, 'rejected')}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: LIVE DISPATCH */}
        {tab === 'live' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-200 mb-2">Live Solo Trips ({liveData.rides?.length || 0})</h3>
              {liveData.rides?.length === 0 ? (
                <div className="text-xs text-slate-500 p-3 bg-slate-800 rounded-xl">No active solo trips right now.</div>
              ) : (
                liveData.rides?.map(r => (
                  <div key={r.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs mb-2">
                    <div>
                      <div className="font-bold text-white">{r.rider_name} &rarr; {r.drop_address}</div>
                      <div className="text-[11px] text-slate-400">Driver: {r.driver_name || 'Searching...'} &bull; Fare: ₹{r.fare}</div>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold rounded capitalize">
                      {r.status.replace('_', ' ')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3 className="font-extrabold text-sm text-slate-200 mb-2">Active Ride Pods ({liveData.pods?.length || 0})</h3>
              {liveData.pods?.length === 0 ? (
                <div className="text-xs text-slate-500 p-3 bg-slate-800 rounded-xl">No active ride pods forming right now.</div>
              ) : (
                liveData.pods?.map(p => (
                  <div key={p.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs mb-2">
                    <div>
                      <div className="font-bold text-emerald-400">{p.pod_code}</div>
                      <div className="text-[11px] text-slate-400">{p.station_slug} &bull; {p.member_count} passengers &bull; ₹{p.seat_fare}/seat</div>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold rounded capitalize">
                      {p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HAZARD MODERATION QUEUE */}
        {tab === 'hazards' && (
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm text-slate-200">Citizen Hazard Reports</h3>
            {hazards.map(h => (
              <div key={h.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{h.category.replace('_', ' ')}</span>
                  <span className="text-[11px] text-slate-400">Upvotes: <b>{h.upvotes}</b></span>
                </div>
                <h4 className="font-bold text-sm text-white">{h.title}</h4>
                <p className="text-xs text-slate-300">{h.description}</p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Station: {h.station_slug} &bull; Status: <span className="font-bold text-white uppercase">{h.moderation_status}</span>
                </div>

                <div className="pt-2 border-t border-slate-700 flex gap-2">
                  <button
                    onClick={() => handleModerateHazard(h.id, 'active')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                  >
                    Keep Active
                  </button>
                  <button
                    onClick={() => handleModerateHazard(h.id, 'resolved')}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => handleModerateHazard(h.id, 'rejected')}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                  >
                    Reject / Spam
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: USERS & MODERATION */}
        {tab === 'users' && (
          <div className="space-y-2">
            <h3 className="font-extrabold text-sm text-slate-200 mb-2">Registered Platform Users</h3>
            {usersList.map(u => (
              <div key={u.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{u.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded uppercase font-bold">{u.role}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">{u.phone}</div>
                </div>

                <div>
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleToggleBan(u.id, u.is_banned === 1)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                        u.is_banned ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {u.is_banned ? 'Unban User' : 'Ban User'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: STATS */}
        {tab === 'stats' && stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Total Riders</div>
              <div className="text-2xl font-black text-indigo-400 mt-1">{stats.totalRiders}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Total Drivers</div>
              <div className="text-2xl font-black text-yellow-400 mt-1">{stats.totalDrivers}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Online Drivers</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{stats.onlineDrivers}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Pending Approval</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{stats.pendingDrivers}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Total Rides</div>
              <div className="text-2xl font-black text-white mt-1">{stats.totalRides}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Active Hazards</div>
              <div className="text-2xl font-black text-rose-400 mt-1">{stats.activeHazards}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
