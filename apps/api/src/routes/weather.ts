import express, { Request, Response } from 'express'
import { requireAuth } from '../middleware/auth'

const router = express.Router()

// Simple in-memory cache, keyed by rounded coordinates — weather and the
// avalanche bulletin don't change meaningfully within a few minutes, and
// this avoids hammering the upstream free APIs (and the SLF bulletin only
// updates twice a day anyway) on every dashboard/tour-detail page load.
type CacheEntry = { data: any; expiresAt: number }
const weatherCache = new Map<string, CacheEntry>()
const WEATHER_TTL_MS = 10 * 60 * 1000 // 10 minutes
let bulletinCache: CacheEntry | null = null
const BULLETIN_TTL_MS = 60 * 60 * 1000 // 1 hour — bulletin itself updates twice daily

function cacheKey(lat: number, lng: number) {
  // Round to ~1km grid — alpine weather doesn't meaningfully differ at
  // finer resolution than the underlying model anyway, and this keeps the
  // cache useful across nearby requests instead of being keyed per-pixel.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

// GET /weather?lat=&lng=&activity=  — combined weather + UV + thunderstorm
// risk + (seasonal) avalanche danger for a single point. This is the one
// endpoint both tour creation (planning) and tour detail / dashboard
// (live context) call — same shape, same safety-relevant fields, no
// duplicated logic between "planning" and "observing" views.
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string)
  const lng = parseFloat(req.query.lng as string)
  const activity = (req.query.activity as string) ?? ''

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat und lng sind erforderlich' })
  }

  try {
    const key = cacheKey(lat, lng)
    const cached = weatherCache.get(key)
    let weather: any
    if (cached && cached.expiresAt > Date.now()) {
      weather = cached.data
    } else {
      weather = await fetchOpenMeteo(lat, lng)
      weatherCache.set(key, { data: weather, expiresAt: Date.now() + WEATHER_TTL_MS })
    }

    // Avalanche bulletin only matters for snow-related activities, and only
    // outside summer — fetching/showing it otherwise would be noise, not
    // safety information.
    const isSnowActivity = ['SKITOUR', 'SKI_SNOWBOARD'].includes(activity) ||
      activity.toLowerCase().includes('schnee')
    const month = new Date().getMonth() + 1 // 1-12
    const isWinterSeason = month <= 5 || month >= 11
    let avalanche: any = null
    if (isSnowActivity || isWinterSeason) {
      avalanche = await getAvalancheBulletin(lat, lng)
    }

    res.json({
      weather,
      avalanche,
      fetchedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[weather] error:', err.message)
    res.status(502).json({ error: 'Wetterdaten konnten nicht geladen werden' })
  }
})

async function fetchOpenMeteo(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: [
      'temperature_2m', 'apparent_temperature', 'precipitation', 'weather_code',
      'wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'cloud_cover', 'uv_index',
    ].join(','),
    hourly: [
      'temperature_2m', 'precipitation_probability', 'precipitation', 'weather_code',
      'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'visibility', 'uv_index', 'cape',
      'freezing_level_height',
    ].join(','),
    daily: [
      'temperature_2m_max', 'temperature_2m_min', 'uv_index_max', 'precipitation_sum',
      'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max',
      'sunrise', 'sunset', 'weather_code',
    ].join(','),
    timezone: 'Europe/Zurich',
    forecast_days: '5',
  })

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
  return res.json()
}

// SLF warning-region lookup is geometry-based and expensive to compute
// server-side without a GIS library, so we use the simplified icon map
// (lightweight JSON-like product) and let the client show the regional
// bulletin link for full detail — this gives a usable danger-level signal
// without pulling in spatial-query dependencies for an approximate need.
async function getAvalancheBulletin(lat: number, lng: number) {
  if (bulletinCache && bulletinCache.expiresAt > Date.now()) {
    return bulletinCache.data
  }
  try {
    const res = await fetch('https://aws.slf.ch/api/bulletin/caaml/de')
    if (!res.ok) throw new Error(`SLF HTTP ${res.status}`)
    const xml = await res.text()
    const summary = parseBulletinSummary(xml, lat, lng)
    bulletinCache = { data: summary, expiresAt: Date.now() + BULLETIN_TTL_MS }
    return summary
  } catch (err: any) {
    console.error('[weather] SLF bulletin error:', err.message)
    return null
  }
}

// Minimal CAAML parsing: pulls out the highest danger rating mentioned in
// the document plus the validity window. A full warning-region polygon
// match would need a GIS library; for a safety hint (not a replacement for
// reading the actual bulletin) the overall maximum is a reasonable,
// dependency-free approximation, and the UI always links to the official
// source for the real, region-specific picture.
function parseBulletinSummary(xml: string, lat: number, lng: number) {
  const dangerRatings = [...xml.matchAll(/<avDangerRating[^>]*>[\s\S]*?<value>([^<]+)<\/value>/g)]
    .map((m) => m[1])
  const ratingMap: Record<string, number> = { low: 1, moderate: 2, considerable: 3, high: 4, very_high: 5 }
  const numericRatings = dangerRatings.map((r) => ratingMap[r] ?? 0).filter((n) => n > 0)
  const maxRating = numericRatings.length > 0 ? Math.max(...numericRatings) : null

  const validTimeMatch = xml.match(/<validTime>[\s\S]*?<endPosition>([^<]+)<\/endPosition>/)
  const validUntil = validTimeMatch ? validTimeMatch[1] : null

  return {
    maxDangerLevel: maxRating,
    validUntil,
    bulletinUrl: 'https://www.slf.ch/de/lawinenbulletin-und-schneesituation',
  }
}

export default router