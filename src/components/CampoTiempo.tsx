import { useEffect, useRef, useState } from 'react'
import { Square, Timer } from 'lucide-react'
import { Campo } from './ui'
import { cn, vibrar } from '@/lib/utils'

/** "45" → 45 · "1:30" → 90 · "20:00" → 1200 */
export function segundosDesdeTexto(texto: string): number | null {
  const limpio = texto.trim()
  if (!limpio) return null
  if (limpio.includes(':')) {
    const [min, seg] = limpio.split(':')
    const m = Number(min)
    const s = Number(seg)
    if (Number.isNaN(m) || Number.isNaN(s)) return null
    return m * 60 + s
  }
  const n = Number(limpio)
  return Number.isNaN(n) ? null : n
}

/** 90 → "1:30" */
export function textoDesdeSegundos(segundos: number | null): string {
  if (segundos === null) return ''
  const m = Math.floor(segundos / 60)
  const s = Math.round(segundos % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Campo para los ejercicios que se miden aguantando: se puede escribir el
 * tiempo (en segundos o mm:ss) o cronometrarlo, que en mitad de una plancha es
 * bastante más cómodo que contar de cabeza.
 */
export function CampoTiempo({
  valor,
  onCambiar,
  objetivo,
  etiqueta,
}: {
  valor: number | null
  onCambiar: (segundos: number | null) => void
  /** los segundos que pide el plan, para el marcador del cronómetro */
  objetivo?: number | null
  etiqueta: string
}) {
  const [texto, setTexto] = useState(() => textoDesdeSegundos(valor))
  const [corriendo, setCorriendo] = useState(false)
  const inicioRef = useRef(0)

  // Si el valor cambia por fuera (al cargar la sesión), el campo se pone al día
  useEffect(() => {
    if (!corriendo) setTexto(textoDesdeSegundos(valor))
  }, [valor, corriendo])

  useEffect(() => {
    if (!corriendo) return
    const t = setInterval(() => {
      const va = Math.round((Date.now() - inicioRef.current) / 1000)
      setTexto(textoDesdeSegundos(va))
      if (objetivo && va === objetivo) vibrar([200, 80, 200])
    }, 200)
    return () => clearInterval(t)
  }, [corriendo, objetivo])

  const arrancar = () => {
    inicioRef.current = Date.now()
    setCorriendo(true)
    vibrar(60)
  }

  const parar = () => {
    setCorriendo(false)
    const va = Math.round((Date.now() - inicioRef.current) / 1000)
    onCambiar(va)
    setTexto(textoDesdeSegundos(va))
    vibrar([120, 60, 120])
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <Campo
        type="text"
        inputMode="numeric"
        readOnly={corriendo}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const s = segundosDesdeTexto(texto)
          onCambiar(s)
          setTexto(textoDesdeSegundos(s))
        }}
        placeholder={objetivo ? textoDesdeSegundos(objetivo) : 'mm:ss'}
        aria-label={etiqueta}
        className={cn(
          'min-h-11 flex-1 text-center tabular-nums',
          corriendo && 'border-[var(--color-acento)] font-bold',
        )}
      />
      <button
        type="button"
        onClick={corriendo ? parar : arrancar}
        aria-label={corriendo ? 'Parar el cronómetro' : 'Cronometrar'}
        title={corriendo ? 'Parar' : 'Cronometrar'}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl border transition',
          corriendo
            ? 'border-[var(--color-acento)] bg-[var(--color-acento)] text-white'
            : 'border-[var(--color-borde)] text-[var(--color-suave)]',
        )}
      >
        {corriendo ? <Square size={16} /> : <Timer size={18} />}
      </button>
    </div>
  )
}
