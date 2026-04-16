import { type Request, type Response, type NextFunction } from 'express';
import { getRawDb } from '../db/client';

export interface AuthUser {
  id: string;
  email?: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const db = getRawDb();
    const session = db.prepare(
      `SELECT s.user_id, u.email, u.role
       FROM sessions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    ).get(token) as { user_id: string; email?: string; role: string } | undefined;

    if (!session) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.auth = {
      id: session.user_id,
      email: session.email,
      role: session.role || 'user',
    };
    next();
  } catch {
    res.status(500).json({ error: 'Auth error' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
