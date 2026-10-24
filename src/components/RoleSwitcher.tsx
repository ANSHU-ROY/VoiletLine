// src/components/RoleSwitcher.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Car, User, LogOut, ChevronDown, Sparkles } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { user, logout, switchDemoUser } = useAuth();
  const currentPath = window.location.pathname;
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-3 py-2">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo / Brand */}
        <a href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white font-extrabold shadow-md">
            V
          </div>
          <div>
            <div className="font-extrabold text-slate-900 leading-none text-sm tracking-tight">VioletLink</div>
            <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">Faridabad Transit</div>
          </div>
        </a>

        {/* Portal Links (Clean navigation without session hijacking) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <a
            href="/rider"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              currentPath.startsWith('/rider') || currentPath === '/'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3 h-3" /> Rider
          </a>

          <a
            href="/driver"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              currentPath.startsWith('/driver')
                ? 'bg-yellow-400 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Car className="w-3 h-3" /> Driver
          </a>

          <a
            href="/admin"
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
              currentPath.startsWith('/admin')
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3 h-3" /> Admin
          </a>
        </div>

        {/* User Status / Demo Account Switcher */}
        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => setShowDemoMenu(!showDemoMenu)}
            className="p-1.5 text-slate-500 hover:text-violet-600 rounded-lg hover:bg-slate-100 text-xs font-bold flex items-center gap-0.5"
            title="Switch Demo Profiles"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <ChevronDown className="w-3 h-3" />
          </button>

          {user && (
            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-slate-100"
              title={`Logged in as ${user.name} (${user.role}). Click to log out.`}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}

          {/* Demo Profiles Dropdown Modal */}
          {showDemoMenu && (
            <div className="absolute right-0 top-9 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-fadeIn text-xs">
              <div className="text-[10px] font-extrabold uppercase text-slate-400 px-2 py-1 tracking-wider">
                1-Click Demo Profiles
              </div>
              <button
                onClick={async () => {
                  await switchDemoUser('rider');
                  setShowDemoMenu(false);
                  window.location.href = '/rider';
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-violet-50 flex items-center gap-2 text-slate-800 font-semibold"
              >
                <div className="w-2 h-2 rounded-full bg-violet-600" />
                <div>
                  <div className="font-bold">Pooja Sharma (Rider)</div>
                  <div className="text-[10px] text-slate-400">9876543210 &bull; Bata Chowk</div>
                </div>
              </button>

              <button
                onClick={async () => {
                  await switchDemoUser('driver');
                  setShowDemoMenu(false);
                  window.location.href = '/driver';
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-yellow-50 flex items-center gap-2 text-slate-800 font-semibold"
              >
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div>
                  <div className="font-bold">Ramesh Kumar (Driver)</div>
                  <div className="text-[10px] text-slate-400">9811122201 &bull; Auto Approved</div>
                </div>
              </button>

              <button
                onClick={async () => {
                  await switchDemoUser('admin');
                  setShowDemoMenu(false);
                  window.location.href = '/admin';
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-100 flex items-center gap-2 text-slate-800 font-semibold"
              >
                <div className="w-2 h-2 rounded-full bg-slate-900" />
                <div>
                  <div className="font-bold">Transit Admin</div>
                  <div className="text-[10px] text-slate-400">9999900001 &bull; Central Console</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
