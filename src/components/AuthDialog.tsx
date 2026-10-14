import { useState } from 'react'
import type { FormEvent } from 'react'
import { login, signup, requestPasswordRecovery, updateUser, AuthError, MissingIdentityError } from '@netlify/identity'
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react'
import { Modal } from './Modal'

export type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery'

function authError(error: unknown) {
  if (error instanceof MissingIdentityError) return 'Die Anmeldung ist momentan nicht verfügbar. Bitte versuche es nach dem Deployment erneut.'
  if (error instanceof AuthError) {
    if (error.status === 400 || error.status === 401) return 'E-Mail oder Passwort ungültig. Falls du neu bist, bestätige zuerst deine E-Mail.'
    if (error.status === 422) return 'Diese E-Mail ist bereits registriert oder das Passwort ist zu schwach.'
    if (error.status === 429) return 'Zu viele Versuche. Bitte warte einen Moment.'
  }
  return 'Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.'
}

export function AuthDialog({ mode, setMode, onClose }: { mode: AuthMode; setMode: (mode: AuthMode) => void; onClose: () => void }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [success, setSuccess] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      if (mode === 'forgot') { await requestPasswordRecovery(email); setSuccess('Wenn diese E-Mail registriert ist, erhältst du einen Link zum Zurücksetzen.') }
      else if (mode === 'recovery') { await updateUser({ password }); onClose() }
      else if (mode === 'signup') {
        const user = await signup(email, password)
        if (user.confirmedAt) onClose()
        else setSuccess('Fast geschafft! Bestätige deine E-Mail über den Link in deinem Postfach und melde dich anschließend an.')
      } else { await login(email, password); onClose() }
    } catch (caught) { setError(authError(caught)) }
    finally { setBusy(false) }
  }
  function switchMode(next: AuthMode) { setMode(next); setError(''); setSuccess(''); setPassword('') }
  const title = mode === 'signup' ? 'Deine Woche beginnt hier.' : mode === 'forgot' ? 'Zurück in dein Roster.' : mode === 'recovery' ? 'Ein neues Passwort.' : 'Willkommen zurück.'
  return <Modal title={title} eyebrow="DEIN PERSÖNLICHER RAID-HUB" onClose={() => { if (!busy) onClose() }}><p className="modal-description">{mode === 'signup' ? 'Erstelle dein kostenloses Konto. Dein Roster bleibt privat.' : mode === 'forgot' ? 'Wir senden dir einen sicheren Link per E-Mail.' : 'Melde dich an und behalte jeden Clear im Blick.'}</p><form onSubmit={submit} className="form-stack">{mode !== 'recovery' && <label>E-Mail-Adresse<input type="email" autoComplete="email" placeholder="du@beispiel.de" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254}/></label>}{mode !== 'forgot' && <label>Passwort<div className="password-input"><input type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 10} maxLength={128} placeholder={mode === 'signup' ? 'Mindestens 10 Zeichen' : 'Dein Passwort'} value={password} onChange={event => setPassword(event.target.value)} required/><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>}{error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status"><Check size={18}/>{success}</p>}<button className="button primary full" disabled={busy || Boolean(success)}>{busy ? <LoaderCircle size={17} className="spin"/> : <ArrowRight size={17}/>} {mode === 'signup' ? 'Kostenlos registrieren' : mode === 'forgot' ? 'Link senden' : mode === 'recovery' ? 'Passwort speichern' : 'Anmelden'}</button></form>{mode === 'login' && <button className="text-button recovery-link" disabled={busy} onClick={() => switchMode('forgot')}>Passwort vergessen?</button>}<div className="auth-switch">{mode === 'signup' ? 'Bereits ein Konto?' : 'Noch kein Konto?'} <button className="text-button gold" disabled={busy} onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Jetzt anmelden' : 'Kostenlos registrieren'}</button></div><div className="secure-note"><ShieldCheck size={14}/> Sicher geschützt mit Netlify Identity</div></Modal>
}
