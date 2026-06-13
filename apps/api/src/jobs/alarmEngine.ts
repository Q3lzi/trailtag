import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { sendSms } from '../lib/twilio'

// Expo Push Notification
async function sendExpoPush(expoPushToken: string, title: string, body: string) {
  if (!expoPushToken.startsWith('ExponentPushToken')) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: expoPushToken, title, body, sound: 'default', priority: 'high' })
    })
    console.log('📲 Push sent to:', expoPushToken)
  } catch (err) {
    console.error('Push error:', err)
  }
}

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
      // STUFE 2: ETA überschritten → sofort ALARM setzen (Portal zeigt Alarm)
      if (diffMin >= 0) {
        await triggerStage(tour.id, 2, async () => {
          console.log(`🟠 STUFE 2: ${tour.user.name} — ÜBERFÄLLIG! Status → ALARM`)
          await prisma.tour.update({ where: { id: tour.id }, data: { status: 'ALARM', alarmStage: 2 } })
          // Push to user's device
          const u = await prisma.user.findUnique({ where: { id: tour.userId }, select: { expoPushToken: true } })
          if (u?.expoPushToken) {
            await sendExpoPush(u.expoPushToken, '⚠️ Safety-Timer abgelaufen', 'Du bist noch nicht zurückgekehrt. Bitte jetzt einchecken oder Notfallkontakte werden alarmiert.')
          }
        })
      }
      // STUFE 3: 60 min nach ETA → SMS an Notfallkontakte
      if (diffMin >= 60) {
        await triggerStage(tour.id, 3, async () => {
          console.log(`🔴 STUFE 3: ${tour.user.name} — SMS WIRD GESENDET!`)
          // SMS an alle Notfallkontakte
          const tourWithContacts = await prisma.tour.findUnique({
            where: { id: tour.id },
            include: { user: { include: { emergencyContacts: true } } }
          })
          const contacts = tourWithContacts?.user?.emergencyContacts ?? []
          if (contacts.length > 0) {
            for (const contact of contacts) {
              if (contact.phone) {
                await sendSms(
                  contact.phone,
                  `🚨 TRAILTAG ALARM: ${tour.user.name} ist seit über 1 Stunde überfällig. Bitte sofort melden oder Rettung kontaktieren!`
                )
              }
            }
          } else {
            // Fallback: TWILIO_TO_NUMBER
            await sendSms(
              process.env.TWILIO_TO_NUMBER!,
              `🚨 TRAILTAG ALARM: ${tour.user.name} ist seit über 1 Stunde überfällig. Bitte sofort melden!`
            )
          }
          await prisma.tour.update({
            where: { id: tour.id },
            data: { alarmStage: 3 }
          })
        })
        // STUFE 4: 2h nach ETA → Zweite SMS
        if (diffMin >= 120) {
          await triggerStage(tour.id, 4, async () => {
            console.log(`🚨 STUFE 4: ${tour.user.name} — ZWEITE SMS`)
            await sendSms(
              process.env.TWILIO_TO_NUMBER!,
              `🚨 TRAILTAG NOTFALL: ${tour.user.name} ist seit über 2 Stunden überfällig. Emergency Services kontaktieren!`
            )
            await prisma.tour.update({
              where: { id: tour.id },
              data: { alarmStage: 4 }
            })
          })
        }
      }
    }
  })
}