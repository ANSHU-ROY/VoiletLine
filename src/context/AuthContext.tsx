// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, pass: string, role?: string) => Promise<void>;
  loginOtp: (phone: string, otp: string, role?: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
  switchDemoUser: (role: 'rider' | 'driver' | 'admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('violetlink_token'));
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('violetlink_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to fetch user session:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (identifier: string, pass: string, role?: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: pass, role })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    localStorage.setItem('violetlink_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const loginOtp = async (phone: string, otp: string, role?: string) => {
    const res = await fetch('/api/auth/login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, role })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'OTP verification failed');
    }

    const data = await res.json();
    localStorage.setItem('violetlink_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (payload: any) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }

    const data = await res.json();
    localStorage.setItem('violetlink_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('violetlink_token');
    setToken(null);
    setUser(null);
  };

  const switchDemoUser = async (role: 'rider' | 'driver' | 'admin') => {
    const credentials = {
      rider: { id: '9876543210', pass: 'password123' }, // Pooja Sharma
      driver: { id: '9811122201', pass: 'password123' }, // Ramesh Kumar
      admin: { id: '9999900001', pass: 'password123' } // Central Admin
    };

    await login(credentials[role].id, credentials[role].pass, role);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginOtp, register, logout, switchDemoUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
