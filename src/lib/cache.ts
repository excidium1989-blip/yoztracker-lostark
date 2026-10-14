import { trackerSchema } from './raids'
import type { Tracker } from './raids'

function openKeys(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('yoztracker-device', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('keys')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deviceKey(owner: string): Promise<CryptoKey> {
  const db = await openKeys()
  try {
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const request = db.transaction('keys').objectStore('keys').get(owner)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    if (existing) return existing
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('keys', 'readwrite')
      transaction.objectStore('keys').put(key, owner)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    return key
  } finally { db.close() }
}

export async function readCache(owner: string): Promise<Tracker | null> {
  try {
    const text = localStorage.getItem(`yoztracker:${owner}`)
    if (!text) return null
    const payload = JSON.parse(text)
    const bytes = new Uint8Array(payload.data)
    const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, await deviceKey(owner), bytes)
    return trackerSchema.parse(JSON.parse(new TextDecoder().decode(decoded)))
  } catch { return null }
}

export async function writeCache(owner: string, state: Tracker): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deviceKey(owner), new TextEncoder().encode(JSON.stringify(state)))
  localStorage.setItem(`yoztracker:${owner}`, JSON.stringify({ iv: [...iv], data: [...new Uint8Array(encrypted)] }))
}
