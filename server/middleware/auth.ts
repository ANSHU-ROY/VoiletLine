// server/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IDatabaseAdapter } from '../db/adapter.js';

const JWT_SECRET = process.env.JWT_SECRET || 'violetlink_dev_jwt_secret_key_change_in_production_998877';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: 'rider' | 'driver' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      db?: IDatabaseAdapter;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, phone: user.phone, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (err) {
    return null;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  // Check if user is banned
  if (req.db) {
    const user = req.db.queryOne('SELECT is_banned FROM users WHERE id = ?', [decoded.id]);
    if (user && user.is_banned) {
      return res.status(403).json({ error: 'Your account has been suspended by administration.' });
    }
  }

  req.user = decoded;
  next();
}

export function requireRole(...allowedRoles: ('rider' | 'driver' | 'admin')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to ${allowedRoles.join('/')}. Current role is ${req.user.role}.`
      });
    }

    // Extra strict rule: If role is driver, verify approval status for operational endpoints
    if (req.user.role === 'driver' && req.db) {
      const driver = req.db.queryOne<{ status: string }>('SELECT status FROM driver_profiles WHERE user_id = ?', [req.user.id]);
      if (!driver) {
        return res.status(403).json({ error: 'Driver profile not registered.' });
      }
      const pathToCheck = req.path || req.originalUrl || req.url || '';
      // If attempting to go online or accept rides, driver must be approved
      if (pathToCheck.includes('online') || pathToCheck.includes('accept')) {
        if (driver.status !== 'approved') {
          return res.status(403).json({
            error: `Driver registration is ${driver.status}. You cannot go online until approved by admin.`
          });
        }
      }
    }

    next();
  };
}
