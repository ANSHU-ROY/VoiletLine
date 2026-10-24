// src/App.tsx
import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { RoleSwitcher } from './components/RoleSwitcher';
import { RiderApp } from './rider/RiderApp';
import { DriverApp } from './driver/DriverApp';
import { AdminApp } from './admin/AdminApp';

export const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
          <RoleSwitcher />

          <main className="flex-1">
            {currentPath.startsWith('/driver') ? (
              <DriverApp />
            ) : currentPath.startsWith('/admin') ? (
              <AdminApp />
            ) : (
              <RiderApp />
            )}
          </main>
        </div>
      </SocketProvider>
    </AuthProvider>
  );
};
