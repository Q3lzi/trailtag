import express, { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/email'

const router = express.Router()

function generateCode(): string {
  return String(crypto.randomInt(100000, 999999))
}

// GET /auth/me — nur mit gültigem Token
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, name: true, email: true, createdAt: true, emailVerified: true }
  })
  res.json(user)
})

// POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, birthYear } = req.body
  if (!email || !password || !name) return res.status(400).json({ error: 'Alle Felder erforderlich' })
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'E-Mail bereits registriert' })

  const passwordHash = await bcrypt.hash(password, 12)
  const verifyCode = generateCode()
  const verifyCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000)

  const user = await (prisma.user as any).create({
    data: { email, passwordHash, name, birthYear, verifyCode, verifyCodeExpiresAt }
  })

  await sendVerificationEmail(email, name, verifyCode)

  // Auto-login after register — token issued immediately, verification is separate
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' })

  res.status(201).json({
    message: 'Registrierung erfolgreich',
    token,
    user: { id: user.id, name: user.name, email: user.email },
    // Dev fallback: if email isn't configured, expose the code so testing works
    devCode: process.env.RESEND_API_KEY ? undefined : verifyCode,
  })
})

// POST /auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Ungültige Zugangsdaten' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Ungültige Zugangsdaten' })

  if ((user as any).isLocked) {
    return res.status(403).json({ error: 'Dieses Konto wurde gesperrt. Bitte kontaktiere den Support.' })
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '30d' })

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, emailVerified: (user as any).emailVerified, isAdmin: (user as any).isAdmin },
  })
})

// POST /auth/verify-email
router.post('/verify-email', requireAuth, async (req: Request, res: Response) => {
  const { code } = req.body
  const user = await (prisma.user as any).findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
  if (user.emailVerified) return res.json({ message: 'Bereits bestätigt' })
  if (!user.verifyCode || user.verifyCode !== code) {
    return res.status(400).json({ error: 'Ungültiger Code' })
  }
  if (!user.verifyCodeExpiresAt || new Date() > user.verifyCodeExpiresAt) {
    return res.status(400).json({ error: 'Code abgelaufen. Fordere einen neuen an.' })
  }
  await (prisma.user as any).update({
    where: { id: req.userId },
    data: { emailVerified: true, verifyCode: null, verifyCodeExpiresAt: null }
  })
  res.json({ message: 'E-Mail bestätigt ✓' })
})

// POST /auth/resend-verification
router.post('/resend-verification', requireAuth, async (req: Request, res: Response) => {
  const user = await (prisma.user as any).findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' })
  if (user.emailVerified) return res.json({ message: 'Bereits bestätigt' })
  const verifyCode = generateCode()
  const verifyCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
  await (prisma.user as any).update({ where: { id: req.userId }, data: { verifyCode, verifyCodeExpiresAt } })
  await sendVerificationEmail(user.email, user.name, verifyCode)
  res.json({ message: 'Code erneut gesendet', devCode: process.env.RESEND_API_KEY ? undefined : verifyCode })
})

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'E-Mail erforderlich' })
  const user = await (prisma.user as any).findUnique({ where: { email } })
  // Always return success — don't leak whether email exists
  if (user) {
    const resetCode = generateCode()
    const resetCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await (prisma.user as any).update({ where: { id: user.id }, data: { resetCode, resetCodeExpiresAt } })
    await sendPasswordResetEmail(email, user.name, resetCode)
  }
  res.json({ message: 'Falls diese E-Mail registriert ist, wurde ein Code gesendet.' })
})

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Alle Felder erforderlich' })
  if (newPassword.length < 8) return res.status(400).json({ error: 'Passwort muss mind. 8 Zeichen haben' })

  const user = await (prisma.user as any).findUnique({ where: { email } })
  if (!user || !user.resetCode || user.resetCode !== code) {
    return res.status(400).json({ error: 'Ungültiger Code' })
  }
  if (!user.resetCodeExpiresAt || new Date() > user.resetCodeExpiresAt) {
    return res.status(400).json({ error: 'Code abgelaufen. Fordere einen neuen an.' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await (prisma.user as any).update({
    where: { id: user.id },
    data: { passwordHash, resetCode: null, resetCodeExpiresAt: null }
  })
  res.json({ message: 'Passwort erfolgreich geändert' })
})

export default router