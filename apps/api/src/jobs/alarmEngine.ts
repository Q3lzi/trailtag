import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { sendSms } from '../lib/twilio'
// Hilfsfunktion: Stufe nur auslösen wenn noch nicht geschehen
async function triggerStage(tourId: string, stage: number, action: () => Promise<void>) {
  // Prüfen ob diese Stufe schon ausgelöst wurde
  const existing = await prisma.alarmEvent.findFirst({
    where: { tourId, stage }
  })
  if (existing) return // bereits ausgelöst — nichts tun
  // Aktion ausführen (SMS, Push, Log...)
  await action()
  // Event speichern — verhindert Doppel-Auslösung
  await prisma.alarmEvent.create({
    data: { tourId, stage, channel: 'console', delivered: true }
  })
}
export function startAlarmEngine() {
  console.log('⏰ Alarm-Engine gestartet')
  // Jede Minute ausführen: '* * * * *'
  cron.schedule('* * * * *', async () => {
    const now = new Date()
    // Alle aktiven Touren laden
    const activeTours = await prisma.tour.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true }
    })
    for (const tour of activeTours) {
      if (!tour.eta) continue // keine ETA = überspringen
      // Wie viele Minuten seit ETA? (negativ = noch nicht fällig)
      const diffMin = (now.getTime() - tour.eta.getTime()) / 60000
      // STUFE 1: 30 min VOR ETA — Vorwarnung
      if (diffMin > -30 && diffMin < 0) {
        await triggerStage(tour.id, 1, async () => {
          console.log(`🟡 STUFE 1: ${tour.user.name} — bald zurück?`)
          // TODO: Push Notification senden
        })
      }
      // STUFE 2: ETA überschritten → ALARM
      if (diffMin >= 0 && diffMin < 60) {
        await triggerStage(tour.id, 2, async () => {
          console.log(`🟠 STUFE 2: ${tour.user.name} — ÜBERFÄLLIG!`)
          // Tour auf ALARM setzen
          await prisma.tour.update({
            where: { id: tour.id },
            data: { alarmStage: 2 }
          })
        })
      }
      // STUFE 3+4: 60 min nach ETA → Notfall
      if (diffMin >= 60) {
        await triggerStage(tour.id, 3, async () => {
        console.log(`🔴 STUFE 3: ${tour.user.name} — ICE WIRD ALARMIERT!`)
        await sendSms(
            process.env.TWILIO_TO_NUMBER!,
            `🚨 TRAILTAG ALARM: ${tour.user.name} ist seit über 1 Stunde überfällig. Bitte sofort melden!`
        )
        await prisma.tour.update({
            where: { id: tour.id },
            data: { status: 'ALARM', alarmStage: 3 }
        })
        })
        await triggerStage(tour.id, 4, async () => {
          console.log(`🚨 STUFE 4: ${tour.user.name} — MEDIZINDATEN FREIGEGEBEN`)
          await prisma.tour.update({
            where: { id: tour.id },
            data: { alarmStage: 4 }
          })
        })
      }
    }
  })
}