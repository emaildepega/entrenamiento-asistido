import { useEffect, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, fechaCorta } from '@/lib/utils'

const CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Selector de fecha con calendario en popover. La fecha se muestra siempre en
 * dd/mm/yy. No se usa <input type="date"> en ninguna parte de la app.
 */
export function SelectorFecha({
  valor,
  onCambiar,
  etiqueta = 'Fecha',
  className,
}: {
  valor: Date
  onCambiar: (fecha: Date) => void
  etiqueta?: string
  className?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [mes, setMes] = useState(() => startOfMonth(valor))
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    setMes(startOfMonth(valor))
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto, valor])

  const dias = eachDayOfInterval({
    start: startOfWeek(startOfMonth(mes), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }),
  })

  return (
    <div ref={caja} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-label={`${etiqueta}: ${fechaCorta(valor)}`}
        className={cn(
          'flex min-h-12 w-full items-center gap-2 rounded-xl border border-[var(--color-borde)]',
          'bg-[var(--color-fondo)] px-3 text-left text-[15px] hover:border-[var(--color-acento)]',
        )}
      >
        <CalendarDays size={18} className="text-[var(--color-suave)]" />
        <span className="tabular-nums">{fechaCorta(valor)}</span>
      </button>

      {abierto && (
        <div className="absolute bottom-full z-50 mb-2 w-[19rem] rounded-2xl border border-[var(--color-borde)] bg-[var(--color-tarjeta)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMes((m) => subMonths(m, 1))}
              aria-label="Mes anterior"
              className="rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-bold capitalize">
              {format(mes, 'LLLL yyyy', { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setMes((m) => addMonths(m, 1))}
              aria-label="Mes siguiente"
              className="rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {CABECERA.map((d, i) => (
              <span
                key={`${d}-${i}`}
                className="py-1 text-center text-[11px] font-bold text-[var(--color-suave)]"
              >
                {d}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const seleccionado = isSameDay(d, valor)
              const delMes = isSameMonth(d, mes)
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => {
                    onCambiar(d)
                    setAbierto(false)
                  }}
                  className={cn(
                    'aspect-square rounded-lg text-sm font-semibold tabular-nums transition',
                    seleccionado
                      ? 'bg-[var(--color-acento)] text-white'
                      : delMes
                        ? 'text-[var(--color-texto)] hover:bg-[var(--color-borde)]'
                        : 'text-[var(--color-suave)]/40',
                  )}
                >
                  {format(d, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
