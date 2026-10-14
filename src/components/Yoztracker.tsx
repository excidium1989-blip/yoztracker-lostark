import { Fragment, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { logout } from '@netlify/identity'
import { z } from 'zod'
import { ArrowDown, ArrowRight, Check, ChevronDown, ChevronRight, CircleHelp, Coins, Download, ExternalLink, Grid2X2, LayoutDashboard, List, LoaderCircle, LockKeyhole, LogIn, LogOut, Plus, RefreshCw, Search, Settings2, ShieldCheck, Swords, Trash2, Users, X } from 'lucide-react'
import { CLASSES, RAIDS, characterSchema, formatGold, goldProgress, nextReset, rosterGoldProgress, topRaids, weekKey } from '../lib/raids'
import type { Character } from '../lib/raids'
import { parseRosterUrl } from '../lib/lostark'
import { useTracker } from '../lib/useTracker'
import { Modal } from './Modal'
import { AuthDialog } from './AuthDialog'
import type { AuthMode } from './AuthDialog'
import { CharacterCard, ClassIcon } from './CharacterCard'

type Dialog = 'catalogue' | 'help' | 'settings' | 'import' | 'character' | 'delete' | 'unlink' | 'reset' | null
const importResponseSchema = z.object({ characters: z.array(characterSchema.extend({ goldProvided: z.boolean() })).min(1).max(100), week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), url: z.string().url(), notice: z.string() })

function rosterLabel(source: string): string {
  try {
    const url = parseRosterUrl(source)
    return `${decodeURIComponent(url.pathname.split('/')[3])} · ${url.pathname.split('/')[2]}`
  } catch { return source === 'Manuell' ? 'Manuelle Charaktere' : source }
}

function Emblem({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'emblem small' : 'emblem'} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 3 41 13v20L24 45 7 33V13L24 3Z" stroke="currentColor" strokeWidth="1.5"/><path d="m15 15 9 12 9-12M24 27v10M13 11l11 6 11-6" stroke="currentColor" strokeWidth="2.5"/><path d="m11 30 7-4m19 4-7-4" stroke="currentColor"/></svg>
}

export function Yoztracker() {
  const tracker = useTracker()
  const [auth, setAuth] = useState<AuthMode | null>(null), [dialog, setDialog] = useState<Dialog>(null)
  const [nav, setNav] = useState('overview'), [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState(''), [classFilter, setClassFilter] = useState('all'), [sort, setSort] = useState('manual')
  const [rosterUrl, setRosterUrl] = useState(''), [busy, setBusy] = useState(false), [formError, setFormError] = useState('')
  const [unlinkSource, setUnlinkSource] = useState<string | null>(null)
  const [editing, setEditing] = useState<Character | null>(null), [name, setName] = useState('')
  const [className, setClassName] = useState<Character['className']>('Slayer'), [level, setLevel] = useState('')
  const [reset, setReset] = useState<Date | null>(null)
  const progress = goldProgress(tracker.state.characters)
  const rosterProgress = rosterGoldProgress(tracker.state.characters, tracker.state.links)
  const latestRosterLink = tracker.state.links.at(-1)
  const rosterRegion = latestRosterLink ? new URL(latestRosterLink).pathname.split('/')[2] : 'Region'
  useEffect(() => { setReset(nextReset()); const timer = window.setInterval(() => setReset(nextReset()), 60000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (tracker.recovery) setAuth('recovery') }, [tracker.recovery])
  useEffect(() => { try { const saved = localStorage.getItem('yoztracker:view'); if (saved === 'grid' || saved === 'list') setView(saved) } catch { } }, [])
  const setLayout = (next: 'grid' | 'list') => { setView(next); try { localStorage.setItem('yoztracker:view', next) } catch { } }
  const closeDialog = () => { if (!busy) { setDialog(null); setFormError('') } }
  const closeAuth = () => { setAuth(null); tracker.setRecovery(false) }
  const openCharacter = (character: Character | null = null) => {
    if (!tracker.user) { setAuth('login'); return }
    setEditing(character); setName(character?.name ?? ''); setClassName(character?.className ?? 'Slayer'); setLevel(character?.itemLevel.toString() ?? ''); setFormError(''); setDialog('character')
  }
  const openAdmin = (next: Dialog) => { if (!tracker.user) setAuth('login'); else { setFormError(''); setDialog(next) } }
  function modifyCharacter(id: string, transform: (character: Character) => Character) {
    tracker.update(previous => ({ ...previous, characters: previous.characters.map(character => character.id === id ? transform(character) : character) }))
  }
  function orderedCharacters(characters: Character[]) {
    return [...characters].sort((first, second) => sort === 'manual' ? 0 : sort === 'name' ? first.name.localeCompare(second.name) : second.itemLevel - first.itemLevel)
  }
  function moveCharacter(id: string, neighborId: string | undefined) {
    if (!neighborId) return
    const updated = tracker.update(previous => {
      const characters = orderedCharacters(previous.characters)
      const position = characters.findIndex(character => character.id === id)
      const neighborPosition = characters.findIndex(character => character.id === neighborId)
      if (position < 0 || neighborPosition < 0) return previous
      const character = characters[position]
      characters[position] = characters[neighborPosition]
      characters[neighborPosition] = character
      return { ...previous, characters }
    })
    if (updated) setSort('manual')
  }
  async function unlinkRoster() {
    if (!unlinkSource || busy) return
    setBusy(true)
    setFormError('')
    try {
      const updated = tracker.update(previous => ({ ...previous, links: previous.links.filter(link => link !== unlinkSource), characters: previous.characters.filter(character => character.source !== unlinkSource) }))
      if (!updated) throw new Error('Bitte melde dich erneut an, um das Roster zu entbinden.')
      await tracker.flush()
      if (rosterUrl === unlinkSource) setRosterUrl('')
      setUnlinkSource(null)
      setDialog('import')
      tracker.setNotice('Roster entbunden. Der Link, seine Charaktere und ihre Raid-Haken wurden entfernt. Die Änderung wird mit der Cloud synchronisiert.')
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'Das Roster konnte nicht entbunden werden.') }
    finally { setBusy(false) }
  }
  function toggleGold(character: Character, raidId: string) {
    if (!character.gold.includes(raidId) && character.gold.length >= 3) { tracker.setNotice('Maximal 3 Gold-Raids pro Charakter. Wähle zuerst einen anderen Gold-Raid ab.'); return }
    modifyCharacter(character.id, current => ({ ...current, gold: current.gold.includes(raidId) ? current.gold.filter(id => id !== raidId) : current.gold.length < 3 ? [...current.gold, raidId] : current.gold }))
  }
  async function importRoster(event: FormEvent) {
    event.preventDefault(); setBusy(true); setFormError('')
    try {
      const owner = tracker.user?.id
      if (!owner) throw new Error('Bitte melde dich an, um dein Roster zu importieren.')
      const initialWeek = tracker.state.week
      const initialCharacters = new Map(tracker.state.characters.map(character => [character.id, character]))
      let source: URL
      try { source = parseRosterUrl(rosterUrl) } catch {
        throw new Error('Bitte gib einen öffentlichen HTTPS-Charakter- oder Roster-Link von lostark.bible mit Region und Charaktername ein. Die Startseite allein enthält kein Roster.')
      }
      const signal = AbortSignal.timeout(40000)
      let response: Response
      let payload: unknown
      try {
        response = await fetch('/.netlify/functions/import-roster', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: source.href }) })
        try { payload = await response.json() } catch {
          throw new Error('Der Importdienst liefert momentan keine lesbare Antwort. Bitte versuche es später erneut. Dein bestehendes Roster bleibt unverändert.')
        }
      } catch (caught) {
        if (signal.aborted) throw new Error('Der Import dauert zu lange. Bitte versuche es später erneut. Dein bestehendes Roster bleibt unverändert.')
        if (caught instanceof TypeError) throw new Error('Der Importdienst ist nicht erreichbar. Bitte prüfe deine Internetverbindung und versuche es erneut. Dein bestehendes Roster bleibt unverändert.')
        throw caught
      }
      if (!response.ok) {
        const error = z.object({ error: z.string() }).safeParse(payload)
        throw new Error(error.success ? error.data.error : response.status === 401 ? 'Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.' : 'Der Importdienst ist momentan nicht verfügbar. Dein bestehendes Roster bleibt unverändert.')
      }
      const parsed = importResponseSchema.safeParse(payload)
      if (!parsed.success) throw new Error('Die importierten Roster-Daten sind unvollständig oder ungültig. Dein bestehendes Roster bleibt unverändert.')
      const data = parsed.data
      const imported = data.characters
      const updated = tracker.update(previous => {
        if (previous.links.length >= 30 && !previous.links.includes(data.url)) throw new Error('Maximal 30 Roster-Links sind erlaubt.')
        const merged = new Map(previous.characters.map(character => [character.id, character]))
        for (const { goldProvided, ...character } of imported) {
          const current = merged.get(character.id)
          const initial = initialCharacters.get(character.id)
          const initialCompleted = initialWeek === previous.week ? initial?.completed ?? [] : []
          const eligible = topRaids(character.itemLevel).map(raid => raid.id)
          const incomingClears = data.week === previous.week ? character.completed : []
          const unchangedGold = current?.gold.length === initial?.gold.length && current?.gold.every(raidId => initial?.gold.includes(raidId))
          const gold = current && (!goldProvided || !unchangedGold) ? current.gold : character.gold
          const completed = eligible.filter(raidId => current?.completed.includes(raidId) || (incomingClears.includes(raidId) && Boolean(current?.completed.includes(raidId)) === initialCompleted.includes(raidId)))
          merged.set(character.id, { ...character, gold: gold.filter(raidId => eligible.includes(raidId)), completed })
        }
        if (merged.size > 100) throw new Error('Maximal 100 Charaktere sind erlaubt.')
        return { ...previous, characters: [...merged.values()], links: [...new Set([...previous.links, data.url])] }
      }, owner)
      if (!updated) throw new Error('Deine Sitzung hat sich geändert. Bitte melde dich erneut an und starte den Import noch einmal.')
      await tracker.flush()
      tracker.setNotice(`${imported.length} Charaktere gelesen. ${data.notice}`); setRosterUrl(''); setDialog(null)
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : 'Import fehlgeschlagen. Bitte versuche es erneut.') }
    finally { setBusy(false) }
  }
  function saveCharacter(event: FormEvent) {
    event.preventDefault()
    const itemLevel = Number(level)
    if (!name.trim() || !Number.isFinite(itemLevel) || itemLevel < 0 || itemLevel > 2500 || level === '') { setFormError('Bitte gib einen Namen und ein gültiges Item-Level zwischen 0 und 2500 ein.'); return }
    if (!editing && tracker.state.characters.length >= 100) { setFormError('Maximal 100 Charaktere sind erlaubt.'); return }
    if (tracker.state.characters.some(character => character.id !== editing?.id && character.name.toLowerCase() === name.trim().toLowerCase())) { setFormError('Dieser Charaktername existiert bereits in deinem Roster.'); return }
    const character: Character = { id: editing?.id ?? crypto.randomUUID(), name: name.trim(), className, itemLevel, source: editing?.source ?? 'Manuell', gold: editing?.gold ?? [], completed: editing?.completed ?? [] }
    tracker.update(previous => ({ ...previous, characters: editing ? previous.characters.map(current => current.id === editing.id ? character : current) : [...previous.characters, character] })); setDialog(null)
  }
  async function signOut() {
    setBusy(true)
    try { await tracker.flush(); await logout(); setDialog(null); setNav('overview'); setSearch('') } catch { tracker.setNotice('Abmelden fehlgeschlagen. Bitte versuche es erneut.') }
    finally { setBusy(false) }
  }
  const filtered = orderedCharacters(tracker.state.characters).filter(character => character.name.toLowerCase().includes(search.toLowerCase()) && (classFilter === 'all' || character.className === classFilter))
  const resetDate = reset ? reset.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '') : 'MITTWOCH'
  const remaining = reset ? Math.max(0, Math.ceil((reset.getTime() - Date.now()) / 3600000)) : 0
  const weekLabel = reset ? `${new Date(`${weekKey()}T10:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} – ${reset.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}` : 'DEINE AKTUELLE RAID-WOCHE'

  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/" aria-label="Yoztracker Startseite"><Emblem/><div>YOZ<span>TRACKER</span><small>YOUR ROSTER. YOUR RULES.</small></div></a><div className="sidebar-label">DEIN WORKSPACE</div><nav className="main-nav" aria-label="Hauptnavigation"><button className={nav === 'overview' ? 'active' : ''} onClick={() => setNav('overview')} aria-label="Übersicht"><LayoutDashboard size={18}/> Übersicht</button><button className={nav === 'roster' ? 'active' : ''} onClick={() => { if (tracker.user) setNav('roster'); else setAuth('login') }} aria-label="Mein Roster"><Users size={18}/> Mein Roster {!tracker.user && <LockKeyhole size={12} className="nav-end"/>}</button><button onClick={() => setDialog('catalogue')} aria-label="Raid-Katalog"><Swords size={18}/> Raid-Katalog <span className="nav-new">T4</span></button><button onClick={() => openAdmin('settings')} aria-label="Einstellungen"><Settings2 size={18}/> Einstellungen</button></nav><div className="sidebar-bottom"><div className="sidebar-reset"><div className="reset-icon"><RefreshCw size={17}/></div><span>NÄCHSTER RESET<strong>{resetDate} <span>10:00 UTC</span></strong></span><span className="live-dot"/></div><button className="help-button" onClick={() => setDialog('help')}><CircleHelp size={17}/> Hilfe & Informationen<ChevronRight size={14}/></button><div className="sidebar-foot">MADE FOR THE GRIND.<span>Yoztracker <span>v1.0</span></span></div></div></aside>
  <div className="workspace"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={12}/><b>{nav === 'roster' ? 'Mein Roster' : 'Übersicht'}</b></div><div className="topbar-actions"><span className="game-tag"><Swords size={12}/> LOST ARK</span><span className="topbar-divider"/>{tracker.user ? <><button className={`sync-button ${tracker.sync === 'offline' ? 'offline' : ''}`} onClick={tracker.retry} title="Cloud-Speicherung erneut versuchen">{tracker.sync === 'saving' ? <LoaderCircle className="spin" size={13}/> : tracker.sync === 'offline' ? <RefreshCw size={13}/> : <span className="live-dot"/>}<span>{tracker.sync === 'saving' ? 'Speichert …' : tracker.sync === 'offline' ? 'Lokal gespeichert' : 'Synchronisiert'}</span></button><button className="button small outline logout" onClick={signOut} disabled={busy}><LogOut size={14}/><span>Abmelden</span></button></> : <><span className="private-tag"><LockKeyhole size={12}/><span>Privater Workspace</span></span><button className="button small outline" onClick={() => setAuth('login')}><LogIn size={14}/> Anmelden</button></>}</div></header>
  <main className="main-content"><section className="hero"><img className="hero-image" src="/.netlify/images?url=/img/abyss-fortress.png&w=1800&fm=webp&q=85" alt="Dunkle Festung über einem nebligen Abyss" onError={event => { if (!event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = '/img/abyss-fortress.png' } else event.currentTarget.style.display = 'none' }}/><div className="hero-overlay"/><div className="hero-content"><div className="eyebrow"><span/> DEIN LOST ARK RAID TRACKER</div><h1>DIESE WOCHE<br/>GEHÖRT DIR<span>.</span></h1><div className="global-gold" role="status" aria-live="polite" aria-atomic="true"><span>GESAMT-GOLD BEIDER ROSTER:</span><strong>{tracker.user ? formatGold(progress.earned) : '—'} <small>/ {tracker.user ? formatGold(progress.maximum) : '—'} G</small></strong></div><p>Weniger Chaos. Mehr Clears.<br className="mobile-break"/> Dein gesamtes Roster, ein einziger Überblick.</p><div className="hero-meta"><span className="hero-chip"><span className="live-dot"/> RAID-WOCHE AKTIV</span><span>{weekLabel}</span></div></div><div className="hero-corner"><span>ARKESIA</span><span>THE GRIND NEVER STOPS</span></div><div className="hero-rune" aria-hidden="true">IV</div></section>
  {tracker.notice && <div className="notice" role="status"><CircleHelp size={17}/><span>{tracker.notice}</span><button className="icon-button" onClick={() => tracker.setNotice('')} aria-label="Hinweis schließen"><X size={16}/></button></div>}
  <section className="stats-grid" aria-label="Wöchentlicher Fortschritt"><div className="stat-card"><div className="stat-icon gold-icon"><Coins size={21}/></div><div className="stat-content"><span>WÖCHENTLICHE GOLD-RAIDS</span><strong>{tracker.user ? progress.done : '—'}<small> / {tracker.user ? progress.total : '—'}</small><span className="stat-unit">CLEARS</span></strong><div className="stat-progress"><span style={{ width: `${tracker.user ? progress.percentage : 0}%` }}/></div></div><span className="stat-corner">{tracker.user ? `${progress.percentage}%` : <LockKeyhole size={13}/>}</span></div><div className="stat-card"><div className="stat-icon"><Users size={21}/></div><div className="stat-content"><span>DEIN ROSTER</span><strong>{tracker.user ? tracker.state.characters.length.toString().padStart(2, '0') : '—'}<span className="stat-unit">CHARAKTERE</span></strong><p>{tracker.user ? `${tracker.state.links.length} verknüpfte Roster · alle an einem Ort` : 'Nur für dich sichtbar'}</p></div><span className="stat-corner">{tracker.user ? <Grid2X2 size={14}/> : <LockKeyhole size={13}/>}</span></div><div className="stat-card reset-stat"><div className="stat-icon"><RefreshCw size={21}/></div><div className="stat-content"><span>NÄCHSTER WOCHENRESET</span><strong>{reset ? Math.floor(remaining / 24) : '—'}<small>d</small> {reset ? remaining % 24 : '—'}<small>h</small></strong><p>Mittwoch · 10:00 UTC</p></div><span className="stat-corner"><span className="live-dot"/></span></div></section>
  {tracker.user && !tracker.loading && rosterProgress.length > 0 && <section className="roster-gold-grid" aria-label="Gold je Roster">{rosterProgress.map(roster => <div className="roster-gold-card" key={roster.source}><div><Coins size={16}/><span>{rosterLabel(roster.source)}<small>{roster.characterCount} Charaktere · {roster.done} / {roster.total} Gold-Clears</small></span></div><strong>{formatGold(roster.earned)} <small>/ {formatGold(roster.maximum)} G</small></strong></div>)}</section>}
  {tracker.loading ? <div className="loading-panel" aria-label="Workspace wird geladen"><LoaderCircle className="spin" size={23}/><p>Dein Workspace wird geladen …</p></div> : tracker.user ? <section className="roster-section"><div className="section-heading"><div><div className="eyebrow">DEIN WÖCHENTLICHER GAMEPLAN</div><h2>Mein Roster <span className="count-badge">{tracker.state.characters.length}</span></h2></div><div className="section-actions"><button className="button outline" onClick={() => openCharacter()}><Plus size={15}/><span>Charakter</span></button><button className="button primary" onClick={() => openAdmin('import')}><Plus size={16}/> Roster importieren</button></div></div><div className="roster-toolbar"><div className="search-input"><Search size={16}/><input aria-label="Charakter suchen" placeholder="Charakter suchen …" value={search} onChange={event => setSearch(event.target.value)}/></div><div className="select-wrap"><select aria-label="Nach Klasse filtern" value={classFilter} onChange={event => setClassFilter(event.target.value)}><option value="all">Alle Klassen</option>{CLASSES.map(name => <option key={name}>{name}</option>)}</select><ChevronDown size={14}/></div><div className="select-wrap sort-select"><ArrowDown size={13}/><select aria-label="Sortierung" value={sort} onChange={event => setSort(event.target.value)}><option value="manual">Eigene Reihenfolge</option><option value="level">Item-Level</option><option value="name">Name</option></select><ChevronDown size={14}/></div><div className="view-switch"><button aria-label="Kachelansicht" aria-pressed={view === 'grid'} className={view === 'grid' ? 'selected' : ''} onClick={() => setLayout('grid')}><Grid2X2 size={16}/></button><button aria-label="Listenansicht" aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => setLayout('list')}><List size={17}/></button></div></div>{tracker.state.characters.length === 0 ? <div className="empty-roster"><div className="lock-symbol"><Users size={31}/></div><h3>Dein nächster Clear beginnt hier.</h3><p>Importiere dein Roster von lostark.bible oder lege deinen ersten Charakter an.<br/>Wir zeigen dir automatisch deine vier höchsten verfügbaren Raids.</p><div className="button-row"><button className="button primary" onClick={() => setDialog('import')}><Plus size={16}/> Roster importieren</button><button className="button outline" onClick={() => openCharacter()}>Manuell hinzufügen</button></div></div> : filtered.length === 0 ? <div className="empty-roster"><Search size={30}/><h3>Keine Charaktere gefunden.</h3><p>Passe deine Suche oder den Klassenfilter an.</p><button className="button outline" onClick={() => { setSearch(''); setClassFilter('all') }}>Filter zurücksetzen</button></div> : <div className={`character-grid ${view === 'list' ? 'list-layout' : ''}`}>{filtered.map((character, index) => <CharacterCard key={character.id} character={character} canMoveUp={index > 0} canMoveDown={index < filtered.length - 1} onMoveUp={() => moveCharacter(character.id, filtered[index - 1]?.id)} onMoveDown={() => moveCharacter(character.id, filtered[index + 1]?.id)} onEdit={() => openCharacter(character)} onGold={raidId => toggleGold(character, raidId)} onToggle={raidId => modifyCharacter(character.id, current => ({ ...current, completed: current.completed.includes(raidId) ? current.completed.filter(id => id !== raidId) : [...current.completed, raidId] }))}/>)}</div>}<div className="roster-legend"><span><span className="legend-box cyan"/> Raid erledigt</span><span><Coins size={12} className="gold"/> Ausgewählter Gold-Raid</span><span><ShieldCheck size={12}/> Privat & automatisch gespeichert</span></div></section> : <section className="protected-section"><div className="section-heading"><div><div className="eyebrow">DEIN WÖCHENTLICHER GAMEPLAN</div><h2>Ein Roster. Alles im Blick.</h2></div><span className="section-private"><ShieldCheck size={14}/> NUR FÜR DICH</span></div><div className="access-grid"><div className="protected-card"><div className="decorative-cards" aria-hidden="true">{['Slayer', 'Souleater', 'Paladin'].map((name, index) => <div className="ghost-card" key={name}><ClassIcon name={name}/><div className="ghost-name"/><div className="ghost-line"/>{[0, 1, 2].map(line => <div className="ghost-raid" key={line}><span/><i style={{ width: `${65 - index * 7 - line * 9}%` }}/><b/></div>)}</div>)}</div><div className="access-content"><div className="lock-symbol"><LockKeyhole size={28}/><span className="lock-spark"/></div><h3>Dieses Roster ist geschützt.</h3><p>Deine Charaktere. Dein Fortschritt. Nur für deine Augen.<br/>Melde dich an und mach diese Woche zu deiner.</p><div className="button-row"><button className="button primary" onClick={() => setAuth('login')}><LogIn size={16}/> Anmelden <ArrowRight size={14}/></button><button className="button outline" onClick={() => setAuth('signup')}>Kostenlos registrieren</button></div><span className="access-note"><ShieldCheck size={12}/> Privat. Kostenlos. Für deinen nächsten Clear.</span></div></div><div className="features-card"><div className="eyebrow">WENIGER VERWALTEN. MEHR RAIDEN.</div><h3>Dein Raid-Hub.<br/>Ohne Kompromisse.</h3><div className="feature"><div><Users size={18}/></div><span><strong>Dein ganzes Roster</strong><p>Mehrere Roster. Ein klarer Überblick.</p></span></div><div className="feature"><div><Swords size={18}/></div><span><strong>Nur die Raids, die zählen</strong><p>Deine Top 4. Passend zum Item-Level.</p></span></div><div className="feature"><div><Coins size={18}/></div><span><strong>Jeder Gold-Clear im Blick</strong><p>Bis zu 3 Gold-Raids pro Charakter.</p></span></div><div className="feature-bottom"><span className="live-dot"/> Fortschritt automatisch gespeichert <Check size={13}/></div></div></div></section>}
  {nav !== 'roster' && <section className="spotlight-section"><div className="section-heading"><div><div className="eyebrow">BEREIT FÜR DIE NÄCHSTE HERAUSFORDERUNG?</div><h2>Raid Spotlight <span className="t4-label">TIER 4</span></h2></div><button className="text-button catalogue-link" onClick={() => setDialog('catalogue')}>Alle Raids ansehen <ArrowRight size={14}/></button></div><div className="spotlight-grid">{[{ title: 'DAS NÄCHSTE KAPITEL', symbol: 'I', family: 'horizon', raidIds: ['horizon-stage-1', 'horizon-stage-3'] }, { title: 'STELL DICH DER DUNKELHEIT', symbol: 'II', family: 'belgardin', raidIds: ['belgardin-nm', 'belgardin-hm'] }, { title: 'BEZWINGE DEN ALBTRAUM', symbol: 'III', family: 'serca', raidIds: ['serca-hm', 'serca-nmm'] }].map((spotlight, index) => {
    const raids = RAIDS.filter(raid => spotlight.raidIds.includes(raid.id))
    return <button className={`spotlight-card spotlight-${index}`} key={spotlight.family} onClick={() => setDialog('catalogue')}><span className="spotlight-art" aria-hidden="true"/><span className="spotlight-number" aria-hidden="true">{spotlight.symbol}</span><span className="spotlight-top">HIGH-END RAID <ArrowRight size={15}/></span><span className="spotlight-copy"><span>{spotlight.title}</span><strong>{raids[0]?.name}</strong><span className="spotlight-levels">{raids.map((raid, modeIndex) => <Fragment key={raid.id}>{modeIndex > 0 && <i/>}<b className={`mode ${raid.mode.toLowerCase().replace(' ', '-')}`}>{raid.mode}</b> {raid.level}</Fragment>)}</span></span></button>
  })}</div></section>}
  <footer className="page-footer"><span><Emblem small/> YOZTRACKER <span>Dein Roster. Deine Regeln.</span></span><span>Von Spielern. Für Spieler.<span className="footer-dot">·</span><button onClick={() => setDialog('help')}>Über Yoztracker <ExternalLink size={10}/></button></span></footer></main></div>
  {auth && <AuthDialog mode={auth} setMode={setAuth} onClose={closeAuth}/>}
  {dialog === 'catalogue' && <Modal title="Die Raids, die zählen." eyebrow="RAID-KATALOG · TIER 4" onClose={closeDialog}><p className="modal-description">Pro Charakter erscheinen maximal die vier höchsten verfügbaren Raid-Familien, jeweils im höchsten freigeschalteten Modus oder Stage. Bei gleichem Item-Level haben neuere Katalogeinträge Vorrang. Niedrigere Raids bleiben ausgeblendet.</p><div className="catalogue-list">{[...RAIDS].sort((first, second) => second.level - first.level || second.order - first.order).map(raid => <div key={raid.id}><Swords size={16}/><span>{raid.name}<small className="catalogue-gold">{formatGold(raid.gold)} G</small></span><span className={`mode ${raid.mode.toLowerCase().replace(' ', '-')}`}>{raid.mode}</span><b>{raid.level}</b></div>)}</div><p className="small-print">Anforderungen nach dem festgelegten Yoztracker-Regelwerk. NM, HM, NMM und Stages teilen sich innerhalb einer Raid-Familie den Wochen-Lockout. Vestiges of the End ist nicht enthalten.</p></Modal>}
  {dialog === 'help' && <Modal title="Dein Gameplan, erklärt." eyebrow="HILFE & INFORMATIONEN" onClose={closeDialog}><div className="help-content"><h3>01 · Roster hinzufügen</h3><p>Registriere dich kostenlos und bestätige deine E-Mail. Importiere öffentliche Charakter-Roster von lostark.bible oder füge Charaktere manuell hinzu. Jedes Konto verwaltet ausschließlich sein eigenes Roster.</p><h3>02 · Gold-Raids auswählen</h3><p>Wähle pro Charakter bis zu drei GOLD-Labels aus. Dein Wochenfortschritt zählt genau diese Raids. Hake einen Raid nach dem Clear ab – er leuchtet cyan.</p><h3>03 · Jede Woche neu starten</h3><p>Mittwochs um 10:00 UTC werden die Clear-Haken zurückgesetzt. Charaktere, Roster-Links und deine Gold-Auswahl bleiben erhalten.</p><h3>Dein Roster bleibt privat.</h3><p>Netlify Identity schützt dein Konto. Roster-Daten werden nutzergetrennt in Netlify Database gespeichert. Ein verschlüsselter Browser-Cache sichert deine Änderungen bei Verbindungsproblemen. Der Import übernimmt Wochenabschlüsse nur, wenn die Quelle sie mit einer passenden Wochenangabe bereitstellt.</p><p className="small-print">Yoztracker ist ein unabhängiges Fan-Projekt und nicht mit Smilegate, Amazon Games oder lostark.bible verbunden. Lost Ark und die originalen Klassen-Icons gehören ihren jeweiligen Rechteinhabern.</p></div></Modal>}
  {dialog === 'import' && tracker.user && <Modal title="Dein Roster. Ein Link." eyebrow="LOSTARK.BIBLE INTEGRATION" onClose={closeDialog}><p className="modal-description">Füge mehrere öffentliche Roster nacheinander hinzu. Bereits importierte Charaktere werden aktualisiert, nicht dupliziert.</p><form className="form-stack" onSubmit={importRoster}><label>Öffentlicher Roster-Link<input type="url" placeholder={`https://lostark.bible/character/${rosterRegion}/Name/roster`} value={rosterUrl} onChange={event => setRosterUrl(event.target.value)} required maxLength={600}/></label>{formError && <p role="alert" className="form-error">{formError}</p>}<div className="import-info"><ShieldCheck size={18}/><p>Vorhandene Haken und Gold-Auswahlen bleiben bestehen. Automatische Clears werden nur bei expliziten Angaben für die aktuelle Woche übernommen.</p></div><button className="button primary full" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>} {busy ? 'Roster wird eingelesen …' : 'Roster importieren'}</button></form>{tracker.state.links.length > 0 && <div className="linked-rosters"><h4>VERKNÜPFTE ROSTER</h4>{tracker.state.links.map(link => <div key={link}><a href={link} target="_blank" rel="noreferrer" title={link}>{rosterLabel(link)}<ExternalLink size={12}/></a><div className="linked-roster-actions"><button type="button" className="icon-button" disabled={busy} aria-label={`${rosterLabel(link)} erneut einlesen`} onClick={() => setRosterUrl(link)}><RefreshCw size={13}/></button><button type="button" className="button danger-button small" disabled={busy} aria-label={`${rosterLabel(link)} entbinden`} onClick={() => { setUnlinkSource(link); setFormError(''); setDialog('unlink') }}><Trash2 size={13}/> Entbinden</button></div></div>)}</div>}<button className="text-button manual-link" disabled={busy} onClick={() => openCharacter()}>Lieber einen Charakter manuell hinzufügen <ArrowRight size={13}/></button></Modal>}
  {dialog === 'unlink' && tracker.user && unlinkSource && <Modal title="Roster entbinden?" eyebrow="ROSTER ENTFERNEN" onClose={closeDialog}><p className="modal-description">„{rosterLabel(unlinkSource)}“ wird mit allen zugehörigen Charakteren, Gold-Auswahlen und gespeicherten Raid-Haken entfernt – auch aus deinem lokalen Cache und beim Synchronisieren aus der Cloud. Andere Roster und manuelle Charaktere bleiben unverändert.</p>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="button-row"><button type="button" className="button outline" disabled={busy} onClick={() => { setUnlinkSource(null); setDialog('import'); setFormError('') }}>Abbrechen</button><button type="button" className="button danger-button" disabled={busy} onClick={() => void unlinkRoster()}>{busy ? <LoaderCircle size={15} className="spin"/> : <Trash2 size={15}/>} Roster entfernen</button></div></Modal>}
  {dialog === 'character' && tracker.user && <Modal title={editing ? 'Dein Charakter.' : 'Verstärkung für dein Roster.'} eyebrow={editing ? 'CHARAKTER BEARBEITEN' : 'CHARAKTER HINZUFÜGEN'} onClose={closeDialog}><form className="form-stack" onSubmit={saveCharacter}><label>Charaktername<input value={name} onChange={event => setName(event.target.value)} placeholder="z. B. WILDEXCI" required maxLength={40}/></label><div className="form-columns"><label>Klasse<select value={className} onChange={event => setClassName(event.target.value as Character['className'])}>{CLASSES.map(name => <option key={name}>{name}</option>)}</select></label><label>Item-Level<input type="number" min="0" max="2500" step="0.01" placeholder="1784.17" value={level} onChange={event => setLevel(event.target.value)} required/></label></div><p className="small-print">Deine Top-4-Raids werden automatisch gewählt. Gold-Raids markierst du anschließend direkt im Roster.</p>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="button primary full"><Check size={16}/> {editing ? 'Änderungen speichern' : 'Charakter hinzufügen'}</button>{editing && <button className="text-button danger" type="button" onClick={() => setDialog('delete')}><Trash2 size={14}/> Charakter entfernen</button>}</form></Modal>}
  {dialog === 'delete' && tracker.user && editing && <Modal title="Charakter entfernen?" onClose={closeDialog}><p className="modal-description">„{editing.name}“ und der gespeicherte Fortschritt werden aus deinem Roster entfernt. Andere Charaktere bleiben unverändert.</p><div className="button-row"><button className="button outline" onClick={() => setDialog('character')}>Abbrechen</button><button className="button danger-button" onClick={() => { tracker.update(previous => ({ ...previous, characters: previous.characters.filter(character => character.id !== editing.id) })); setDialog(null) }}><Trash2 size={15}/> Entfernen</button></div></Modal>}
  {dialog === 'settings' && tracker.user && <Modal title="Dein Workspace." eyebrow="EINSTELLUNGEN" onClose={closeDialog}><div className="settings-account"><div className="stat-icon"><ShieldCheck size={23}/></div><div><strong>Roster-Administrator</strong><span>{tracker.user.email}</span></div><span className="live-dot"/></div><div className="settings-row"><span><strong>Ansicht</strong><small>So behältst du dein Roster im Blick.</small></span><div className="view-switch"><button aria-label="Kacheln" className={view === 'grid' ? 'selected' : ''} onClick={() => setLayout('grid')}><Grid2X2 size={17}/></button><button aria-label="Liste" className={view === 'list' ? 'selected' : ''} onClick={() => setLayout('list')}><List size={17}/></button></div></div><div className="settings-row"><span><strong>Cloud-Synchronisierung</strong><small>{tracker.sync === 'offline' ? 'Offline – lokaler Stand gesichert' : 'Sicher & nutzergetrennt gespeichert'}</small></span><button className="button outline small" onClick={tracker.retry}><RefreshCw size={13}/> Sync</button></div><div className="settings-row"><span><strong>Roster exportieren</strong><small>Dein aktueller Stand als JSON-Datei.</small></span><button className="button outline small" onClick={() => { const blob = new Blob([JSON.stringify(tracker.state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `yoztracker-${weekKey()}.json`; link.click(); URL.revokeObjectURL(url) }}><Download size={13}/> Export</button></div><div className="settings-row"><span><strong>Wochenfortschritt zurücksetzen</strong><small>Nur Haken löschen. Gold-Auswahl behalten.</small></span><button className="button outline small" onClick={() => setDialog('reset')}><RefreshCw size={13}/> Reset</button></div></Modal>}
  {dialog === 'reset' && tracker.user && <Modal title="Ein frischer Gameplan?" onClose={closeDialog}><p className="modal-description">Alle Clear-Haken dieser Woche werden gelöscht. Deine Charaktere und Gold-Raid-Auswahl bleiben erhalten.</p><div className="button-row"><button className="button outline" onClick={() => setDialog('settings')}>Abbrechen</button><button className="button primary" onClick={() => { tracker.update(previous => ({ ...previous, characters: previous.characters.map(character => ({ ...character, completed: [] })) })); setDialog(null) }}>Haken zurücksetzen</button></div></Modal>}
  </div>
}
