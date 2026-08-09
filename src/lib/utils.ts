import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formato de fecha estándar de la app: dd/mm/yy. */
export function fechaCorta(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? parseISO(fecha) : fecha
  return format(d, 'dd/MM/yy')
}

/** "Miércoles 12/08/25" */
export function fechaLarga(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? parseISO(fecha) : fecha
  const dia = format(d, 'EEEE', { locale: es })
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${format(d, 'dd/MM/yy')}`
}

/** mm:ss a partir de segundos. */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.round(segundos))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function vibrar(patron: number | number[]) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(patron)
    } catch {
      /* algunos navegadores lo bloquean sin interacción previa */
    }
  }
}

/** Comprueba conexión de verdad, no solo navigator.onLine. */
export async function hayConexionReal(timeoutMs = 5000): Promise<boolean> {
  if (!navigator.onLine) return false
  const control = new AbortController()
  const t = setTimeout(() => control.abort(), timeoutMs)
  try {
    await fetch(`/manifest.webmanifest?ping=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: control.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}
