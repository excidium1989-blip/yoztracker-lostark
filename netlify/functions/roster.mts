import { authenticatedOwner } from '../lib/auth'
import { eq } from 'drizzle-orm'
import { database } from '../../db/index'
import { rosters } from '../../db/schema'
import { emptyTracker, normalizeTracker, trackerSchema } from '../../src/lib/raids'

export default async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  const user = await authenticatedOwner(request)
  if (!user) return Response.json({ error: 'Bitte melde dich an.' }, { status: 401, headers })
  if (!['GET', 'PUT'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, PUT' } })
  try {
    const db = database()
    if (request.method === 'GET') {
      const [row] = await db.select().from(rosters).where(eq(rosters.ownerId, user.id)).limit(1)
      return Response.json({ state: row ? normalizeTracker(row.state) : emptyTracker() }, { headers })
    }
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 403, headers })
    const raw = await request.text()
    if (raw.length > 300_000) return Response.json({ error: 'Roster zu groß.' }, { status: 413, headers })
    let input: unknown
    try { input = JSON.parse(raw) } catch { return Response.json({ error: 'Ungültige Roster-Daten.' }, { status: 400, headers }) }
    const parsed = trackerSchema.safeParse(input)
    if (!parsed.success) return Response.json({ error: 'Ungültige Roster-Daten.' }, { status: 400, headers })
    if (new Set(parsed.data.characters.map(character => character.id)).size !== parsed.data.characters.length) return Response.json({ error: 'Doppelte Charaktere.' }, { status: 400, headers })
    const state = normalizeTracker(parsed.data)
    await db.insert(rosters).values({ ownerId: user.id, state }).onConflictDoUpdate({ target: rosters.ownerId, set: { state, updatedAt: new Date() } })
    return Response.json({ state }, { headers })
  } catch {
    return Response.json({ error: 'Speicherung momentan nicht verfügbar. Dein lokaler Stand bleibt erhalten.' }, { status: 503, headers })
  }
}
