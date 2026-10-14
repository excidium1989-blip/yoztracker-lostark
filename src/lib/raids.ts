import { z } from 'zod'
import { parseRosterUrl } from './lostark'

export type Raid = { id: string; family: string; name: string; mode: 'NM' | 'HM' | 'NMM' | 'Stage 1' | 'Stage 2' | 'Stage 3'; level: number; gold: number; order: number }
const definitions: [string, string, [Raid['mode'], number, number][]][] = [
  ['thaemine', 'Thaemine', [['HM', 1620, 17000]]],
  ['echidna', 'Echidna', [['NM', 1620, 14500], ['HM', 1630, 18500]]],
  ['behemoth', 'Behemoth', [['NM', 1620, 11500]]],
  ['aegir', 'Aegir · Act 1', [['NM', 1660, 19000], ['HM', 1680, 24500]]],
  ['brelshaza', 'Brelshaza · Act 2', [['NM', 1670, 22000], ['HM', 1690, 30500]]],
  ['mordum', 'Mordum · Act 3', [['NM', 1680, 20000], ['HM', 1700, 50000]]],
  ['act4', 'Armoche · Act 4', [['NM', 1700, 23500], ['HM', 1720, 32500]]],
  ['finalday', 'Kazeros · Final Day', [['NM', 1710, 26500], ['HM', 1730, 45000]]],
  ['serca', 'Serca', [['NM', 1710, 25000], ['HM', 1730, 40000], ['NMM', 1740, 40000]]],
  ['horizon', 'Horizon Cathedral', [['Stage 1', 1700, 12000], ['Stage 2', 1720, 14000], ['Stage 3', 1750, 16000]]],
  ['belgardin', 'Belgardin', [['NM', 1750, 28000], ['HM', 1770, 55000], ['NMM', 1780, 55000]]],
]

export const RAIDS: Raid[] = definitions.flatMap(([family, name, modes], order) => modes.map(([mode, level, gold]) => ({
  id: `${family}-${mode.toLowerCase().replace(' ', '-')}`, family, name, mode, level, gold, order,
})))

export function topRaids(level: number): Raid[] {
  const eligible = RAIDS.filter(raid => raid.level <= level)
    .sort((first, second) => second.level - first.level || second.order - first.order)
  const selectedFamilies = new Set<string>()
  return eligible.filter(raid => {
    if (selectedFamilies.has(raid.family)) return false
    selectedFamilies.add(raid.family)
    return true
  }).slice(0, 4)
}

export const CLASSES = ['Slayer', 'Souleater', 'Paladin', 'Bard', 'Artist', 'Berserker', 'Destroyer', 'Gunlancer', 'Arcanist', 'Summoner', 'Sorceress', 'Wardancer', 'Scrapper', 'Soulfist', 'Glaivier', 'Striker', 'Breaker', 'Deathblade', 'Shadowhunter', 'Reaper', 'Sharpshooter', 'Deadeye', 'Artillerist', 'Machinist', 'Gunslinger', 'Aeromancer', 'Wildsoul'] as const

export const characterSchema = z.object({
  id: z.string().min(1).max(160),
  name: z.string().trim().min(1).max(40),
  className: z.enum(CLASSES),
  itemLevel: z.number().min(0).max(2500),
  source: z.string().max(600).default('Manuell'),
  gold: z.array(z.string()).max(3),
  completed: z.array(z.string()).max(4),
})
export const trackerSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  characters: z.array(characterSchema).max(100),
  links: z.array(z.string().url().max(600).refine(value => {
    try {
      const url = new URL(value)
      return parseRosterUrl(value).pathname === url.pathname
    } catch { return false }
  })).max(30),
})
export type Character = z.infer<typeof characterSchema>
export type Tracker = z.infer<typeof trackerSchema>

export function weekKey(date = new Date()): string {
  const reset = new Date(date.getTime())
  reset.setUTCHours(10, 0, 0, 0)
  reset.setUTCDate(reset.getUTCDate() - (reset.getUTCDay() + 4) % 7)
  if (reset.getTime() > date.getTime()) reset.setUTCDate(reset.getUTCDate() - 7)
  return reset.toISOString().slice(0, 10)
}

export function nextReset(): Date {
  const reset = new Date(`${weekKey()}T10:00:00Z`)
  reset.setUTCDate(reset.getUTCDate() + 7)
  return reset
}

export function emptyTracker(): Tracker {
  return { week: weekKey(), characters: [], links: [] }
}

export function normalizeTracker(input: Tracker): Tracker {
  const isNewWeek = input.week !== weekKey()
  return {
    ...input,
    week: weekKey(),
    links: [...new Set(input.links)],
    characters: input.characters.map(character => {
      const eligible = topRaids(character.itemLevel).map(raid => raid.id)
      return { ...character, gold: [...new Set(character.gold)].filter(id => eligible.includes(id)).slice(0, 3), completed: isNewWeek ? [] : [...new Set(character.completed)].filter(id => eligible.includes(id)) }
    }),
  }
}

export function goldProgress(characters: Character[]) {
  const progress = characters.reduce((summary, character) => {
    const selected = topRaids(character.itemLevel).filter(raid => character.gold.includes(raid.id)).slice(0, 3)
    const completed = selected.filter(raid => character.completed.includes(raid.id))
    return {
      total: summary.total + selected.length,
      done: summary.done + completed.length,
      maximum: summary.maximum + selected.reduce((gold, raid) => gold + raid.gold, 0),
      earned: summary.earned + completed.reduce((gold, raid) => gold + raid.gold, 0),
    }
  }, { total: 0, done: 0, maximum: 0, earned: 0 })
  return { ...progress, percentage: progress.total ? Math.round(progress.done / progress.total * 100) : 0 }
}

export function rosterGoldProgress(characters: Character[], links: string[]) {
  const rosters = new Map<string, { source: string; characters: Character[] }>()
  function sourceKey(source: string) {
    try { return parseRosterUrl(source).href.toLowerCase() } catch { return source }
  }
  for (const source of links) {
    const key = sourceKey(source)
    if (!rosters.has(key)) rosters.set(key, { source, characters: [] })
  }
  for (const character of characters) {
    const key = sourceKey(character.source)
    const roster = rosters.get(key) ?? { source: character.source, characters: [] }
    roster.characters.push(character)
    rosters.set(key, roster)
  }
  return [...rosters.values()].map(roster => ({ source: roster.source, characterCount: roster.characters.length, ...goldProgress(roster.characters) }))
}

export function formatGold(gold: number): string {
  return gold.toLocaleString('de-DE')
}
