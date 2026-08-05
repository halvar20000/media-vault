import type { Request, Response, NextFunction } from 'express';

// Session shape augmentation.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'not authenticated' });
  }
  next();
}

// Convenience accessor — safe to call only after requireAuth.
export function userId(req: Request): string {
  return req.session.userId as string;
}
