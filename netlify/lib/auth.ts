import { getUser } from '@netlify/identity'

export async function authenticatedOwner(request: Request): Promise<{ id: string } | null> {
  const user = await getUser()
  if (user) return { id: user.id }
  const cookie = request.headers.get('cookie')?.split(';').find(entry => entry.trim().startsWith('nf_jwt='))
  if (!cookie) return null
  try {
    const token = decodeURIComponent(cookie.trim().slice('nf_jwt='.length))
    if (!token || token.length > 16000) return null
    const response = await fetch(new URL('/.netlify/identity/user', request.url), { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return null
    const verified = await response.json()
    return typeof verified.id === 'string' && verified.id ? { id: verified.id } : null
  } catch { return null }
}
