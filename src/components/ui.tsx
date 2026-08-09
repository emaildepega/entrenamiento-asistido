import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro'

const VARIANTES: Record<Variante, string> = {
  primario:
    'bg-[var(--color-acento)] text-white hover:brightness-110 active:brightness-95',
  secundario:
    'bg-[var(--color-tarjeta)] text-[var(--color-texto)] border border-[var(--color-borde)] hover:border-[var(--color-acento)]',
  fantasma:
    'bg-transparent text-[var(--color-suave)] hover:text-[var(--color-texto)]',
  peligro: 'bg-red-600 text-white hover:brightness-110',
}

export function Boton({
  variante = 'primario',
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTES[variante],
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Tarjeta({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-2xl border border-[var(--color-borde)] bg-[var(--color-tarjeta)] p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Etiqueta({
  tono = 'neutro',
  children,
}: {
  tono?: 'neutro' | 'acento' | 'ok' | 'aviso'
  children: ReactNode
}) {
  const tonos = {
    neutro: 'bg-[var(--color-borde)] text-[var(--color-suave)]',
    acento: 'bg-[var(--color-acento)]/15 text-[var(--color-acento)]',
    ok: 'bg-green-500/15 text-green-400',
    aviso: 'bg-amber-500/15 text-amber-400',
  }
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2.5 py-1 text-xs font-bold',
        tonos[tono],
      )}
    >
      {children}
    </span>
  )
}

export function Campo({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'min-h-12 w-full rounded-xl border border-[var(--color-borde)] bg-[var(--color-fondo)] px-3 text-[15px]',
        'text-[var(--color-texto)] outline-none placeholder:text-[var(--color-suave)]',
        'focus:border-[var(--color-acento)]',
        className,
      )}
    />
  )
}

export function AreaTexto({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-xl border border-[var(--color-borde)] bg-[var(--color-fondo)] p-3 text-[15px]',
        'text-[var(--color-texto)] outline-none placeholder:text-[var(--color-suave)]',
        'focus:border-[var(--color-acento)]',
        className,
      )}
    />
  )
}

export function Dialogo({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = 'max-w-lg',
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alPulsar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPulsar)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[90vh] w-full flex-col rounded-t-3xl border border-[var(--color-borde)]',
          'bg-[var(--color-tarjeta)] sm:rounded-2xl',
          ancho,
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-borde)] p-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[var(--color-suave)]">
      <span className="size-4 animate-spin rounded-full border-2 border-[var(--color-borde)] border-t-[var(--color-acento)]" />
      {texto}
    </div>
  )
}
