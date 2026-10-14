import { authenticatedOwner } from '../lib/auth'
import { unflatten } from 'devalue'
import { CLASSES, topRaids, weekKey } from '../../src/lib/raids'
import type { Character } from '../../src/lib/raids'
import { parseRosterUrl } from '../../src/lib/lostark'
import { importedRaidStatus } from '../lib/raid-import'

type ImportedCharacter = Character & { goldProvided: boolean }

const classIds: Record<string, string> = { '102': 'Berserker', '103': 'Destroyer', '104': 'Gunlancer', '105': 'Paladin', '112': 'Slayer', '202': 'Arcanist', '203': 'Summoner', '204': 'Bard', '205': 'Sorceress', '302': 'Wardancer', '303': 'Scrapper', '304': 'Soulfist', '305': 'Glaivier', '312': 'Striker', '313': 'Breaker', '402': 'Deathblade', '403': 'Shadowhunter', '404': 'Reaper', '405': 'Souleater', '502': 'Sharpshooter', '503': 'Deadeye', '504': 'Artillerist', '505': 'Machinist', '512': 'Gunslinger', '602': 'Artist', '603': 'Aeromancer', '604': 'Wildsoul' }
const classAliases: Record<string, Character['className']> = {
  warlord: 'Gunlancer', holyknight: 'Paladin', berserker_female: 'Slayer',
  arcana: 'Arcanist', elemental_master: 'Sorceress', battle_master: 'Wardancer',
  infighter: 'Scrapper', force_master: 'Soulfist', lance_master: 'Glaivier',
  battle_master_male: 'Striker', infighter_male: 'Breaker', blade: 'Deathblade',
  demonic: 'Shadowhunter', soul_eater: 'Souleater', hawk_eye: 'Sharpshooter',
  devil_hunter: 'Deadeye', blaster: 'Artillerist', scouter: 'Machinist',
  devil_hunter_female: 'Gunslinger', yinyangshi: 'Artist', weather_artist: 'Aeromancer',
  alchemist: 'Wildsoul',
}

class ImportError extends Error {
  constructor(message: string, readonly status = 502) { super(message) }
}

function normalizeClass(value: unknown): Character['className'] | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return
  const key = String(value).trim().toLowerCase()
  const alias = Object.hasOwn(classAliases, key) ? classAliases[key] : undefined
  return alias ?? CLASSES.find(className => className.toLowerCase() === key || className === classIds[key])
}

function collectCharacters(value: unknown, found: Map<string, ImportedCharacter>, source: string, now: Date, depth = 0, seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object' || depth > 18 || seen.has(value)) return
  seen.add(value)
  const record = value as Record<string, unknown>
  const name = record.name ?? record.characterName ?? record.CharacterName
  const rawLevel = record.ilvl ?? record.iLvl ?? record.itemLevel ?? record.ItemAvgLevel
  const itemLevel = typeof rawLevel === 'number' ? rawLevel : typeof rawLevel === 'string' && rawLevel.trim() ? Number(rawLevel.replace(/,/g, '').trim()) : NaN
  const className = normalizeClass(record.class ?? record.className ?? record.classId ?? record.CharacterClassName)
  if (typeof name === 'string' && name.trim().length > 0 && name.length <= 40 && Number.isFinite(itemLevel) && itemLevel >= 0 && itemLevel <= 2500 && className) {
    const status = importedRaidStatus(record, itemLevel, now)
    const region = new URL(source).pathname.split('/')[2]
    const id = `${region.toLowerCase()}:${name.trim().toLowerCase()}`
    const existing = found.get(id)
    const eligible = topRaids(itemLevel).map(raid => raid.id)
    found.set(id, { id, name: name.trim(), itemLevel, className, source, ...status, gold: (status.goldProvided ? status.gold : existing?.gold ?? []).filter(raidId => eligible.includes(raidId)), goldProvided: status.goldProvided || existing?.goldProvided === true, completed: [...new Set([...(existing?.completed ?? []), ...status.completed])].filter(raidId => eligible.includes(raidId)) })
  }
  for (const child of Object.values(record)) collectCharacters(child, found, source, now, depth + 1, seen)
}

async function fetchData(url: URL): Promise<string> {
  const signal = AbortSignal.timeout(12000)
  try {
    const response = await fetch(url, { redirect: 'error', signal, headers: { Accept: 'application/json,text/html', 'User-Agent': 'Yoztracker-Roster-Import/1.0' } })
    if (!response.ok) {
      if (response.status === 404) throw new ImportError('Der Charakter- oder Roster-Link wurde auf lostark.bible nicht gefunden. Bitte prüfe Region, Namen und Sichtbarkeit.', 422)
      if (response.status === 401 || response.status === 403) throw new ImportError('lostark.bible verweigert den Zugriff. Das Roster muss öffentlich sein; auch ein Bot-Schutz kann den Import verhindern.')
      if (response.status === 429) throw new ImportError('lostark.bible erhält momentan zu viele Anfragen. Bitte versuche den Import in einigen Minuten erneut.', 429)
      throw new ImportError('lostark.bible meldet eine Störung. Bitte versuche es später erneut.')
    }
    if (Number(response.headers.get('content-length') ?? 0) > 2_000_000) { await response.body?.cancel(); throw new ImportError('Die Antwort von lostark.bible ist zu groß für einen sicheren Import.', 422) }
    const reader = response.body?.getReader()
    if (!reader) throw new ImportError('lostark.bible hat keine Roster-Daten zurückgegeben.', 422)
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2_000_000) { await reader.cancel(); throw new ImportError('Die Antwort von lostark.bible ist zu groß für einen sicheren Import.', 422) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let position = 0
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length }
    return new TextDecoder().decode(bytes)
  } catch (caught) {
    if (caught instanceof ImportError) throw caught
    if (signal.aborted) throw new ImportError('lostark.bible antwortet nicht rechtzeitig. Bitte versuche den Import später erneut.', 504)
    throw new ImportError('Die Verbindung zu lostark.bible ist fehlgeschlagen oder wurde durch eine Weiterleitung blockiert. Bitte prüfe den öffentlichen Link und versuche es erneut.')
  }
}

function collectPayload(payload: unknown, found: Map<string, ImportedCharacter>, source: string, now: Date) {
  if (payload && typeof payload === 'object' && 'nodes' in payload && Array.isArray(payload.nodes)) {
    for (const node of payload.nodes) {
      if (node?.type === 'data' && Array.isArray(node.data)) {
        try { collectCharacters(unflatten(node.data), found, source, now) } catch { }
      }
    }
  } else collectCharacters(payload, found, source, now)
}

export default async (request: Request) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!await authenticatedOwner(request)) return Response.json({ error: 'Bitte melde dich an.' }, { status: 401, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } })
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Ungültige Anfrage.' }, { status: 403, headers })
  let source: URL
  try {
    const text = await request.text()
    if (text.length > 1000) throw new Error('size')
    const body = JSON.parse(text)
    source = parseRosterUrl(body.url)
  } catch {
    return Response.json({ error: 'Bitte nutze einen öffentlichen HTTPS-Charakter- oder Roster-Link von lostark.bible. Regionen wie CE und euc sind erlaubt; /roster ist optional.' }, { status: 400, headers })
  }
  try {
    const now = new Date()
    const found = new Map<string, ImportedCharacter>()
    const dataUrl = new URL(source)
    dataUrl.pathname += '/__data.json'
    let dataError: unknown
    try {
      const payload = JSON.parse(await fetchData(dataUrl))
      collectPayload(payload, found, source.href, now)
    } catch (caught) { dataError = caught }
    if (!found.size) {
      let html: string
      try { html = await fetchData(source) } catch (caught) { throw dataError instanceof ImportError ? dataError : caught }
      try { collectPayload(JSON.parse(html), found, source.href, now) } catch { }
      for (const match of html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/g)) {
        try { collectPayload(JSON.parse(match[1]), found, source.href, now) } catch { }
      }
    }
    if (!found.size) {
      if (dataError instanceof ImportError) throw dataError
      return Response.json({ error: 'lostark.bible hat keine lesbare Charakterliste mit Namen, unterstützter Klasse und Item-Level geliefert. Prüfe die Roster-Sichtbarkeit oder füge deine Charaktere manuell hinzu.' }, { status: 422, headers })
    }
    const characters = [...found.values()].slice(0, 100)
    const clears = characters.reduce((count, character) => count + character.completed.length, 0)
    const gold = characters.reduce((count, character) => count + character.gold.length, 0)
    return Response.json({ characters, week: weekKey(now), url: source.href, notice: `${clears} aktuelle Wochenabschlüsse und ${gold} Gold-Markierungen erkannt. Abschlüsse ohne bestätigte aktuelle Woche werden nicht übernommen; fehlende Angaben bleiben manuell ergänzbar.` }, { headers })
  } catch (caught) {
    const error = caught instanceof ImportError ? caught : new ImportError('Die Roster-Daten von lostark.bible konnten nicht verarbeitet werden. Bitte versuche es später erneut oder ergänze Charaktere manuell.', 422)
    return Response.json({ error: `${error.message} Dein bestehendes Roster bleibt unverändert.` }, { status: error.status, headers })
  }
}
