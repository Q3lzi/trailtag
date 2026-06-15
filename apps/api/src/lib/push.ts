// Shared push notification helper

export async function sendExpoPush(token: string, title: string, body: string, data?: any) {
  if (!token?.startsWith('ExponentPushToken')) return
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, sound: 'default', priority: 'high', data: data ?? {} })
    })
    const json = await res.json() as any
    if (json?.data?.status === 'error') console.error('Push error:', json.data.message)
  } catch (err) { console.error('Push send error:', err) }
}

// Send push to all accepted friends of a user
export async function sendPushToFriends(prisma: any, userId: string, title: string, body: string, data?: any) {
  try {
    const friends = await prisma.friend.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ initiatorId: userId }, { receiverId: userId }]
      },
      include: {
        initiator: { select: { id: true, expoPushToken: true } },
        receiver: { select: { id: true, expoPushToken: true } }
      }
    })
    for (const f of friends) {
      const friendUser = f.initiatorId === userId ? f.receiver : f.initiator
      if (friendUser?.expoPushToken) {
        await sendExpoPush(friendUser.expoPushToken, title, body, data)
      }
    }
    console.log(`📲 Push gesendet an ${friends.length} Freunde`)
  } catch (err) { console.error('Push to friends error:', err) }
}