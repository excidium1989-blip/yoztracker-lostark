import { useCallback, useEffect, useRef, useState } from 'react'
import { getUser, handleAuthCallback, onAuthChange } from '@netlify/identity'
import type { User } from '@netlify/identity'
import { emptyTracker, normalizeTracker, trackerSchema } from './raids'
import type { Tracker } from './raids'
import { readCache, writeCache } from './cache'

export function useTracker() {
  const [user, setUser] = useState<User | null>(null)
  const [state, setState] = useState<Tracker>(emptyTracker)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<'saved' | 'saving' | 'offline'>('saved')
  const [notice, setNotice] = useState('')
  const [recovery, setRecovery] = useState(false)
  const ownerRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const cacheQueue = useRef<Promise<void>>(Promise.resolve())
  const generation = useRef(0)

  const persist = useCallback((owner: string, next: Tracker) => {
    setSync('saving')
    cacheQueue.current = cacheQueue.current.catch(() => {}).then(async () => {
      try {
        await writeCache(owner, next)
        localStorage.setItem(`yoztracker:pending:${owner}`, 'true')
      } catch { setNotice('Der lokale Browser-Speicher ist nicht verfügbar. Änderungen werden weiterhin in der Cloud gespeichert.') }
    })
    const cacheWrite = cacheQueue.current
    queue.current = queue.current.catch(() => {}).then(async () => {
      await cacheWrite
      if (ownerRef.current !== owner) return
      try {
        const response = await fetch('/.netlify/functions/roster', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
        if (response.status === 401) {
          if (ownerRef.current !== owner) return
          ownerRef.current = null
          setUser(null)
          setState(emptyTracker())
          setNotice('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
          return
        }
        if (!response.ok) throw new Error('save')
        if (ownerRef.current === owner && stateRef.current === next) {
          try { localStorage.removeItem(`yoztracker:pending:${owner}`) } catch { }
          setSync('saved')
        }
      } catch { if (ownerRef.current === owner) setSync('offline') }
    })
  }, [])

  useEffect(() => {
    let alive = true
    async function hydrate(nextUser: User | null) {
      const currentGeneration = ++generation.current
      ownerRef.current = nextUser?.id ?? null
      setUser(null)
      setState(emptyTracker())
      setLoading(true)
      if (!nextUser) { setLoading(false); return }
      let cached: Tracker | null = null
      try { cached = await readCache(nextUser.id) } catch { }
      let next = emptyTracker()
      let pending = false
      try { pending = localStorage.getItem(`yoztracker:pending:${nextUser.id}`) === 'true' } catch { }
      try {
        const response = await fetch('/.netlify/functions/roster', { cache: 'no-store' })
        if (response.status === 401) {
          if (alive && generation.current === currentGeneration) { ownerRef.current = null; setLoading(false); setNotice('Bitte melde dich erneut an. Deine Sitzung ist abgelaufen.') }
          return
        }
        if (!response.ok) throw new Error('load')
        const data = await response.json()
        next = normalizeTracker(pending && cached ? cached : trackerSchema.parse(data.state))
        if (alive && generation.current === currentGeneration) setSync('saved')
      } catch {
        next = normalizeTracker(cached ?? emptyTracker())
        pending = Boolean(cached)
        if (alive && generation.current === currentGeneration) {
          setSync('offline')
          setNotice('Cloud-Verbindung nicht verfügbar. Dein verschlüsselter lokaler Stand wird verwendet.')
        }
      }
      if (!alive || generation.current !== currentGeneration) return
      stateRef.current = next
      setState(next)
      setUser(nextUser)
      setLoading(false)
      if (pending) persist(nextUser.id, next)
    }
    const unsubscribe = onAuthChange((event, currentUser) => {
      if (event === 'login' || event === 'logout') void hydrate(currentUser)
      if (event === 'recovery') { setRecovery(true); void hydrate(currentUser) }
    })
    void (async () => {
      try {
        const result = await handleAuthCallback()
        if (!alive) return
        if (result?.type === 'recovery') setRecovery(true)
        await hydrate(await getUser())
      } catch {
        if (alive) { setNotice('Der Anmeldelink ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.'); setLoading(false) }
      }
    })()
    return () => { alive = false; unsubscribe(); ++generation.current }
  }, [persist])

  const update = useCallback((transform: (previous: Tracker) => Tracker, expectedOwner?: string) => {
    if (!ownerRef.current || !user || loading || (expectedOwner !== undefined && ownerRef.current !== expectedOwner)) return false
    const current = normalizeTracker(stateRef.current)
    const next = normalizeTracker(trackerSchema.parse(transform(current)))
    stateRef.current = next
    setState(next)
    persist(ownerRef.current, next)
    return true
  }, [user, loading, persist])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (ownerRef.current && stateRef.current.week !== emptyTracker().week) update(previous => normalizeTracker(previous))
    }, 60000)
    const retry = () => { if (ownerRef.current) persist(ownerRef.current, stateRef.current) }
    window.addEventListener('online', retry)
    return () => { window.clearInterval(timer); window.removeEventListener('online', retry) }
  }, [update, persist])

  const retry = () => { if (ownerRef.current) persist(ownerRef.current, stateRef.current) }
  const flush = () => cacheQueue.current
  return { user, state, loading, sync, notice, setNotice, update, retry, recovery, setRecovery, flush }
}
