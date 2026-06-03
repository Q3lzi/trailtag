import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendSms(to: string, message: string) {
  console.log('SMS wird gesendet an:', to) // Debug-Zeile
  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: to
    })
    console.log(`📱 SMS gesendet: ${result.sid}`)
    return result
  } catch (error) {
    console.error(`❌ SMS Fehler:`, error)
  }
}