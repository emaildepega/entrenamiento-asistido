import { useEffect, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { Campo } from './ui'
import { useTemporizador, type TareaSerie } from '@/hooks/useTemporizador'
import { cn, reloj } from '@/lib/utils'

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
 * Campo de los ejercicios que se miden aguantando. Se puede escribir el tiempo
 * o pulsar ▶ al empezar la serie: si hay un objetivo cuenta atrás y avisa con
 * alarma al llegar a cero; si no lo hay, cronometra hacia arriba. En los dos
 * casos manda el temporizador global, así que sigue vivo aunque te vayas a otra
 * pantalla.
 */
export function CampoTiempo({
  valor,
  onCambiar,
  objetivo,
  etiqueta,
  tarea,
  nombreEjercicio,
}: {
  valor: number | null
  onCambiar: (segundos: number | null) => void
  /** los segundos que pide el plan, para prerrellenar y para la cuenta atrás */
  objetivo?: number | null
  etiqueta: string
  tarea: TareaSerie
  nombreEjercicio: string
}) {
  const t = useTemporizador()
  const [texto, setTexto] = useState(() => textoDesdeSegundos(valor))

  const esLaMia =
    t.activo &&
    t.tarea?.sesionId === tarea.sesionId &&
    t.tarea?.slug === tarea.slug &&
    t.tarea?.serie === tarea.serie

  const corriendo = esLaMia && !t.terminado

  // Si el valor cambia por fuera (al cargar la sesión), el campo se pone al día
  useEffect(() => {
    if (!corriendo) setTexto(textoDesdeSegundos(valor))
  }, [valor, corriendo])

  const arrancar = () => {
    const escrito = segundosDesdeTexto(texto)
    const segundos = escrito && escrito > 0 ? escrito : (objetivo ?? 0)
    t.iniciar({
      modo: 'serie',
      segundos: segundos > 0 ? segundos : undefined,
      etiqueta: `${nombreEjercicio} · serie ${tarea.serie}`,
      tarea,
    })
  }

  // Parar a mano vale lo aguantado de verdad, no lo que decía el plan
  const parar = () => {
    const contados = Math.round(t.transcurrido)
    onCambiar(contados)
    setTexto(textoDesdeSegundos(contados))
    t.cerrar()
  }

  const enPantalla = corriendo
    ? reloj(t.cuentaAtras ? t.restante : t.transcurrido)
    : texto

  return (
    <div className="flex flex-1 items-center gap-2">
      <Campo
        type="text"
        inputMode="numeric"
        readOnly={corriendo}
        value={enPantalla}
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
        aria-label={corriendo ? 'Parar' : 'Empezar la serie'}
        title={corriendo ? 'Parar' : 'Empezar la serie y avisar al terminar'}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl border transition',
          corriendo
            ? 'border-[var(--color-acento)] bg-[var(--color-acento)] text-white'
            : 'border-[var(--color-borde)] text-[var(--color-suave)]',
        )}
      >
        {corriendo ? <Square size={16} /> : <Play size={18} />}
      </button>
    </div>
  )
}
