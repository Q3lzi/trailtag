import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRouter from './routes/auth'
import toursRouter from './routes/tours'
import { startAlarmEngine } from './jobs/alarmEngine'
import vehiclesRouter from './routes/vehicles'
import qrRouter from './routes/qr'
import gpxRouter from './routes/gpx'
import profileRouter from './routes/profile'
import friendsRouter from './routes/friends'
import weatherRouter from './routes/weather'
import { setupRealtimeServer } from './lib/realtime'

const app = express()

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com"],
      connectSrc: ["'self'", "https://*.tile.openstreetmap.org"],
    }
  }
}))
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use('/auth', authRouter)
app.use('/tours', toursRouter)
app.use('/vehicles', vehiclesRouter)
app.use('/r', qrRouter)
app.use('/gpx', gpxRouter)
app.use('/profile', profileRouter)
app.use('/friends', friendsRouter)
app.use('/weather', weatherRouter)

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Trailtag API',
    timestamp: new Date().toISOString()
  })
})

const PORT = process.env.PORT || 3000

const server = app.listen(PORT, () => {
  console.log(`🚀 Trailtag API läuft auf Port ${PORT}`)
  startAlarmEngine()
})

setupRealtimeServer(server)