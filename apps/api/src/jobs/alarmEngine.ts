import 'dotenv/config'
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { sendSms } from '../lib/twilio'

async function sendExpoPush(token: string, title: string, body: string) {
  if (!token?.startsWith('ExponentPushToken')) return
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high' })
    })
  } catch {}
}

async function triggerStage(tourId: string, stage: number, action: () => Promise<void>) {
  const existing = await prisma.alarmEvent.findFirst({ where: { tourId, stage } })
  if (existing) return
  await action()
  await prisma.alarmEvent.create({ data: { tourId, stage, channel: 'console', delivered: true } })
}

export function startAlarmEngine() {
  console.log('⏰ Alarm-Engine gestartet')
  cron.schedule('* * * * *', async () => {
    const now = new Date()
    const activeTours = await prisma.tour.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { include: { emergencyContacts: true } } }
    })
    for (const tour of activeTours) {
      if (!tour.eta) continue
      const diffMin = (now.getTime() - new Date(tour.eta!).getTime()) / 60000

      // STUFE 1: 30 min VOR ETA — Push Vorwarnung
      if (diffMin > -30 && diffMin < 0) {
        await triggerStage(tour.id, 1, async () => {
          console.log(`🟡 STUFE 1: ${tour.user.name} — bald zurück?`)
          try {
            const u = await (prisma.user as any).findUnique({ where: { id: tour.userId }, select: { expoPushToken: true } })
            if (u?.expoPushToken) await sendExpoPush(u.expoPushToken, '🏔️ Fast zurück?', `Safety-Timer läuft ab um ${new Date(tour.eta!).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} Uhr`)
          } catch {}
        })
      }

      // STUFE 2: ETA überschritten → ALARM + Push
      if (diffMin >= 0) {
        await triggerStage(tour.id, 2, async () => {
          console.log(`🟠 STUFE 2: ${tour.user.name} — ÜBERFÄLLIG! Status → ALARM`)
          await prisma.tour.update({ where: { id: tour.id }, data: { status: 'ALARM', alarmStage: 2 } })
          try {
            const u = await (prisma.user as any).findUnique({ where: { id: tour.userId }, select: { expoPushToken: true } })
            if (u?.expoPushToken) await sendExpoPush(u.expoPushToken, '⚠️ Safety-Timer abgelaufen', 'Du bist noch nicht zurückgekehrt. Bitte jetzt einchecken!')
          } catch {}
        })
      }

      // STUFE 3: 60 min → SMS an Notfallkontakte
      if (diffMin >= 60) {
        await triggerStage(tour.id, 3, async () => {
          console.log(`🔴 STUFE 3: ${tour.user.name} — SMS wird gesendet!`)
          const contacts = tour.user.emergencyContacts ?? []
          if (contacts.length > 0) {
            for (const c of contacts) {
              if (c.phone) await sendSms(c.phone, `🚨 TRAILTAG ALARM: ${tour.user.name} ist seit über 1 Stunde überfällig. Bitte sofort melden oder Rettung kontaktieren!`)
            }
          } else {
            await sendSms(process.env.TWILIO_TO_NUMBER!, `🚨 TRAILTAG ALARM: ${tour.user.name} ist seit über 1 Stunde überfällig!`)
          }
          await prisma.tour.update({ where: { id: tour.id }, data: { alarmStage: 3 } })
        })
      }

      // STUFE 4: 2h → Zweite SMS
      if (diffMin >= 120) {
        await triggerStage(tour.id, 4, async () => {
          console.log(`🚨 STUFE 4: ${tour.user.name} — ZWEITE SMS`)
          await sendSms(process.env.TWILIO_TO_NUMBER!, `🚨 TRAILTAG NOTFALL: ${tour.user.name} ist seit über 2 Stunden überfällig. Emergency Services kontaktieren!`)
          await prisma.tour.update({ where: { id: tour.id }, data: { alarmStage: 4 } })
        })
      }
    }
  })
}