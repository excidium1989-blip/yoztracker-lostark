import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, eyebrow = 'YOZTRACKER', onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const initialFocus = ref.current?.querySelector<HTMLElement>('input, select') ?? ref.current?.querySelector<HTMLElement>('button')
    initialFocus?.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current()
      if (event.key !== 'Tab') return
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, a[href]') ?? [])
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus() }
  }, [])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}><button className="icon-button modal-close" onClick={onClose} aria-label="Schließen"><X size={20}/></button><div className="eyebrow">{eyebrow}</div><h2 id="modal-title">{title}</h2>{children}</div></div>
}
