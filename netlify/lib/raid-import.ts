import { RAIDS, topRaids, weekKey } from '../../src/lib/raids'
import type { Character, Raid } from '../../src/lib/raids'

type ImportStatus = Pick<Character, 'gold' | 'completed'> & { goldProvided: boolean }
type CollectionKind = 'status' | 'completed' | 'gold'

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([name, value]) => [key(name), value]))
}

function explicitFlag(record: Record<string, unknown>, names: string[]): boolean | undefined {
  const values = names.map(name => record[name]).filter(value => typeof value === 'boolean' || value === 0 || value === 1)
  if (values.some(value => value === false || value === 0)) return false
  if (values.some(value => value === true || value === 1)) return true
}

function currentWeek(record: Record<string, unknown>, inherited: boolean, now: Date): boolean {
  const weeks = ['week', 'weekstart', 'weekkey', 'weeklyreset', 'resetat'].filter(name => record[name] !== undefined)
  if (!weeks.length) return inherited
  return weeks.every(name => {
    const value = record[name]
    if (typeof value !== 'string') return false
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value === weekKey(now)
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false
    const date = new Date(value)
    return Number.isFinite(date.getTime()) && date.getTime() <= now.getTime() && weekKey(date) === weekKey(now)
  })
}

function matchRaid(value: unknown, mode: unknown, itemLevel: number): Raid | undefined {
  if (typeof value !== 'string') return
  const normalized = key(value)
  const modeAliases: Record<string, Raid['mode']> = { normal: 'NM', normalmode: 'NM', nm: 'NM', hard: 'HM', hardmode: 'HM', hm: 'HM', nightmare: 'NMM', nmm: 'NMM', stage1: 'Stage 1', stage2: 'Stage 2', stage3: 'Stage 3' }
  const suppliedMode = typeof mode === 'string' ? modeAliases[key(mode)] : undefined
  if (mode !== undefined && !suppliedMode) return
  const sourceRaid = RAIDS.find(raid => {
    if (suppliedMode && suppliedMode !== raid.mode) return false
    const names = [raid.family, raid.name, raid.name.split(' · ')[0]]
    return normalized === key(raid.id) || names.some(name => {
      if (normalized === key(name)) return true
      const aliases = Object.entries(modeAliases).filter(([, alias]) => alias === raid.mode).map(([alias]) => alias)
      return aliases.some(alias => normalized === key(name + alias))
    })
  })
  if (!sourceRaid || sourceRaid.level > itemLevel) return
  return topRaids(itemLevel).find(raid => raid.family === sourceRaid.family)
}

export function importedRaidStatus(character: Record<string, unknown>, itemLevel: number, now: Date): ImportStatus {
  const completed = new Set<string>()
  const gold = new Set<string>()
  let goldProvided = false
  const collectionKinds: Record<string, CollectionKind> = {
    raids: 'status', raidstatus: 'status', raidstatuses: 'status', weeklyraids: 'status', weeklyraidstatus: 'status',
    clearedraids: 'completed', weeklyclears: 'completed', clears: 'completed', completedraids: 'completed', raidclears: 'completed', weeklyraidclears: 'completed',
    goldraids: 'gold', goldearnraids: 'gold', goldearningraids: 'gold',
  }

  function collect(value: unknown, kind: CollectionKind, weekly: boolean, depth: number, raidName?: string, seen = new WeakSet<object>()) {
    if (depth > 18) return
    if (typeof value === 'string' || typeof value === 'boolean' || value === 0 || value === 1) {
      const raid = matchRaid(typeof value === 'string' ? value : raidName, undefined, itemLevel)
      if (!raid || value === false || value === 0) return
      if (weekly && (kind === 'completed' || (kind === 'status' && (value === true || value === 1)))) completed.add(raid.id)
      if (kind === 'gold') gold.add(raid.id)
      return
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      for (const entry of value) collect(entry, kind, weekly, depth + 1, raidName, seen)
      return
    }
    const record = fields(value as Record<string, unknown>)
    const entryWeek = currentWeek(record, weekly, now)
    const nestedRaid = record.raid && typeof record.raid === 'object' ? fields(record.raid as Record<string, unknown>) : {}
    const identity = record.raidid ?? record.id ?? record.raidname ?? record.name ?? record.family ?? nestedRaid.id ?? nestedRaid.name ?? record.raid
    const raid = matchRaid(identity ?? raidName, record.mode ?? record.difficulty ?? nestedRaid.mode, itemLevel)
    const clearFlag = explicitFlag(record, ['completed', 'cleared', 'iscleared', 'iscompleted', 'clear', 'done'])
    const status = typeof record.status === 'string' ? key(record.status) : ''
    const clear = clearFlag ?? (status ? ['completed', 'cleared', 'done'].includes(status) : undefined)
    const goldFlag = explicitFlag(record, ['gold', 'goldearn', 'goldearning', 'isgoldearn', 'isgoldearning', 'isgoldraid', 'earngold', 'goldselected'])
    if (raid) {
      if (entryWeek && (clear === true || (kind === 'completed' && identity !== undefined && clear !== false))) completed.add(raid.id)
      if (goldFlag !== undefined) goldProvided = true
      if (goldFlag === true || (kind === 'gold' && identity !== undefined && goldFlag !== false)) gold.add(raid.id)
    }
    if (identity !== undefined || (raid && (clear !== undefined || goldFlag !== undefined))) return
    for (const [name, child] of Object.entries(record)) {
      const childKind = Object.hasOwn(collectionKinds, name) ? collectionKinds[name] : kind
      if (childKind === 'gold' && child && typeof child === 'object') goldProvided = true
      const childRaidName = raidName && ['nm', 'hm', 'nmm', 'normal', 'hard', 'nightmare', 'stage1', 'stage2', 'stage3'].includes(name) ? `${raidName} ${name}` : name
      if ((child && typeof child === 'object') || typeof child === 'boolean' || child === 0 || child === 1) collect(child, childKind, entryWeek, depth + 1, childRaidName, seen)
    }
  }

  function scan(value: unknown, weekly: boolean, depth: number, visited: WeakSet<object>) {
    if (!value || typeof value !== 'object' || depth > 18 || visited.has(value)) return
    visited.add(value)
    if (Array.isArray(value)) {
      for (const child of value) scan(child, weekly, depth + 1, visited)
      return
    }
    const record = fields(value as Record<string, unknown>)
    if (depth > 0 && (record.charactername !== undefined || ((record.name !== undefined) && (record.itemlevel !== undefined || record.ilvl !== undefined)))) return
    const scopedWeek = currentWeek(record, weekly, now)
    for (const [name, child] of Object.entries(record)) {
      const kind = Object.hasOwn(collectionKinds, name) ? collectionKinds[name] : undefined
      if (kind && child && typeof child === 'object') {
        if (kind === 'gold') goldProvided = true
        collect(child, kind, scopedWeek, depth + 1)
      } else scan(child, scopedWeek, depth + 1, visited)
    }
  }

  scan(character, false, 0, new WeakSet<object>())
  const eligible = topRaids(itemLevel)
  return { completed: eligible.filter(raid => completed.has(raid.id)).map(raid => raid.id), gold: eligible.filter(raid => gold.has(raid.id)).map(raid => raid.id).slice(0, 3), goldProvided }
}
