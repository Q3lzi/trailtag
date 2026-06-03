// dotenv lädt .env Datei — muss als erstes stehen
import 'dotenv/config'
// express importieren — unser Webserver
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRouter from './routes/auth'
import toursRouter from './routes/tours'
import { startAlarmEngine } from './jobs/alarmEngine'
import vehiclesRouter from './routes/vehicles'
import qrRouter from './routes/qr'
// App erstellen — stell dir das vor wie ein leeres Restaurant
const app = express()
// Middleware = Türsteher der jede Anfrage prüft
app.use(helmet()) // Sicherheits-Header automatisch setzen
app.use(cors()) // App darf mit Server reden
app.use(express.json()) // JSON-Daten aus Anfragen lesen
app.use('/auth', authRouter)
app.use('/tours', toursRouter)
app.use('/vehicles', vehiclesRouter)
app.use('/r', qrRouter)
// Erster Endpoint: GET /health
// Wenn jemand /health aufruft → antworte mit "ok"
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Trailtag API',
    timestamp: new Date().toISOString() // immer UTC!
  })
})
// Port aus .env lesen, sonst 3000 als Fallback
const PORT = process.env.PORT || 3000
// Server starten — "höre auf Port 3000"
app.listen(PORT, () => {
  console.log(`🚀 Trailtag API läuft auf Port ${PORT}`)
  startAlarmEngine() // NEU — Engine startet mit dem Server
})