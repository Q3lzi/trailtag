import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
// Express um userId erweitern — TypeScript muss das wissen
declare global {
  namespace Express {
    interface Request { userId?: string }
  }
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Token aus Header lesen: "Authorization: Bearer eyJ..."
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token' })
  }
  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId // userId für den nächsten Endpoint verfügbar
    next() // weiter zum eigentlichen Endpoint
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' })
  }
}

// Must run AFTER requireAuth (needs req.userId already set). Checked
// against the database on every request rather than trusting a JWT claim,
// so revoking admin access takes effect immediately instead of only after
// the token expires.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: 'Nicht angemeldet' })
  const user = await (prisma.user as any).findUnique({ where: { id: req.userId }, select: { isAdmin: true } })
  if (!user?.isAdmin) return res.status(403).json({ error: 'Kein Zugriff' })
  next()
}