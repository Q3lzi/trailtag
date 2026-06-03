import express, { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
const router = express.Router()


// GET /auth/me — nur mit gültigem Token
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, createdAt: true }
  })
  res.json(user)
})

// POST /auth/register — bleibt wie es ist
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, birthYear } = req.body
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'E-Mail bereits registriert' })
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({ data: { email, passwordHash, name, birthYear } })
  res.status(201).json({ message: 'Registrierung erfolgreich', userId: user.id })
})
// POST /auth/login — NEU
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  // 1. User in DB suchen
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Absichtlich gleiche Fehlermeldung — kein Hinweis ob Mail existiert
    return res.status(401).json({ error: 'Ungültige Zugangsdaten' })
  }
  // 2. Passwort prüfen — bcrypt vergleicht Hash mit Eingabe
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Ungültige Zugangsdaten' })
  }
  // 3. JWT Token erstellen — 30 Tage gültig
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  )
  // 4. Token + User-Infos zurückgeben
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email }
  })
})
export default router