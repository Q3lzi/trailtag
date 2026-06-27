import { WebSocketServer, WebSocket } from 'ws'
import { Server as HttpServer } from 'http'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

// Map: userId -> Set of open WebSocket connections (a user can have multiple devices/tabs)
const connections = new Map<string, Set<WebSocket>>()

type RealtimeEvent =
  | { type: 'location_update'; friendId: string; tourId: string; lat: number; lng: number; timestamp: string }
  | { type: 'tour_status_change'; friendId: string; tourId: string; status: string; activity?: string; eta?: string | null }
  | { type: 'friend_request'; fromUserId: string; fromName: string; friendshipId: string }
  | { type: 'friend_request_accepted'; friendshipId: string; byName: string }

function addConnection(userId: string, ws: WebSocket) {
  if (!connections.has(userId)) connections.set(userId, new Set())
  connections.get(userId)!.add(ws)
}

function removeConnection(userId: string, ws: WebSocket) {
  connections.get(userId)?.delete(ws)
  if (connections.get(userId)?.size === 0) connections.delete(userId)
}

function sendToUser(userId: string, event: RealtimeEvent) {
  const sockets = connections.get(userId)
  if (!sockets) return
  const payload = JSON.stringify(event)
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload)
  }
}

// Broadcast an event to all accepted friends of a given user
export async function broadcastToFriends(userId: string, event: RealtimeEvent) {
  try {
    const friendships = await (prisma.friend as any).findMany({
      where: { status: 'ACCEPTED', OR: [{ initiatorId: userId }, { receiverId: userId }] },
      select: { initiatorId: true, receiverId: true }
    })
    for (const f of friendships) {
      const friendId = f.initiatorId === userId ? f.receiverId : f.initiatorId
      sendToUser(friendId, event)
    }
  } catch (err) { console.error('[Realtime] broadcastToFriends error:', err) }
}

// Send an event directly to one specific user (e.g. friend request)
export function sendToSpecificUser(userId: string, event: RealtimeEvent) {
  sendToUser(userId, event)
}

export function setupRealtimeServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    // Auth: expect ?token=<jwt> in the connection URL
    const url = new URL(req.url ?? '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) { ws.close(4001, 'No token'); return }

    let userId: string
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
      userId = payload.userId
    } catch {
      ws.close(4002, 'Invalid token')
      return
    }

    addConnection(userId, ws)
    console.log(`[Realtime] User ${userId} connected (${connections.get(userId)?.size} active)`)

    ws.on('close', () => {
      removeConnection(userId, ws)
      console.log(`[Realtime] User ${userId} disconnected`)
    })

    ws.on('error', () => {
      removeConnection(userId, ws)
    })

    // Heartbeat to detect dead connections
    ws.on('pong', () => { (ws as any).isAlive = true })
    ;(ws as any).isAlive = true

    ws.send(JSON.stringify({ type: 'connected' }))
  })

  // Ping every 30s, terminate connections that didn't respond
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) { ws.terminate(); return }
      ;(ws as any).isAlive = false
      ws.ping()
    })
  }, 30000)

  wss.on('close', () => clearInterval(interval))

  console.log('[Realtime] WebSocket server attached at /ws')
  return wss
}