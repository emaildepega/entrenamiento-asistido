import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, Pause, Play, RotateCcw, Square, Timer, X } from 'lucide-react'
import { useTemporizador } from '@/hooks/useTemporizador'
import { useAjustes } from '@/hooks/useAjustes'
import { dejarPendiente } from '@/lib/seriePendiente'
import { cn, reloj } from '@/lib/utils'

const PRESETS = [60, 90, 120, 180]

/**
 * La barra del temporizador, siempre por encima de la navegación y en una sola
 * pieza: antes convivían el contador, los presets y el aviso de fin pisándose
 * unos a otros. Ahora hay dos filas fijas (contador + controles / ajustes) y un
 * único bloque flotante en pantalla.
 */
export function BarraTemporizador() {
  const t = useTemporizador()
  const { ajustes, cambiar } = useAjustes()
  const [minimizado, setMinimizado] = useState(false)
  const cajaRef = useRef<HTMLDivElement>(null)

  // El contenido de la página se aparta lo que ocupe la barra, medido de
  // verdad: con un número fijo el botón de "Terminar sesión" quedaba debajo.
  useEffect(() => {
    const raiz = document.documentElement
    const caja = cajaRef.current
    if (!caja) {
      raiz.style.setProperty('--alto-temporizador', '0px')
      return
    }
    const medir = () =>
      raiz.style.setProperty('--alto-temporizador', `${caja.offsetHeight + 12}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(caja)
    return () => {
      observador.disconnect()
      raiz.style.setProperty('--alto-temporizador', '0px')
    }
  }, [t.activo, t.terminado, t.modo, minimizado])

  // Cuando salta el aviso, la barra se despliega sola: es el momento en el que
  // hay que hacer algo con ella.
  useEffect(() => {
    if (t.terminado) setMinimizado(false)
  }, [t.terminado])

  if (!t.activo) return null

  const esDescanso = t.modo === 'descanso'
  const valor = t.cuentaAtras ? t.restante : t.transcurrido
  const progreso =
    t.cuentaAtras && t.duracion > 0
      ? Math.min(100, ((t.duracion - t.restante) / t.duracion) * 100)
      : 0

  const titulo = t.terminado
    ? esDescanso
      ? 'Descanso terminado'
      : '¡Tiempo!'
    : esDescanso
      ? 'Descanso'
      : t.cuentaAtras
        ? 'En marcha'
        : 'Cronómetro'

  const cerrarDandoPorBuena = () => {
    if (t.tarea) {
      dejarPendiente({
        ...t.tarea,
        segundos: Math.round(t.cuentaAtras ? t.duracion : t.transcurrido),
      })
      // Encadena el descanso: al acabar la serie toca respirar
      t.iniciar({ modo: 'descanso', segundos: ajustes.descanso_seg })
      return
    }
    t.cerrar()
  }

  /* ------------------------------------------------------------ minimizada - */
  if (minimizado && !t.terminado) {
    return (
      <div className="fixed right-4 z-40 md:right-6" style={{ bottom: 'var(--hueco-nav)' }}>
        <button
          onClick={() => setMinimizado(false)}
          aria-label="Abrir el temporizador"
          className="flex items-center gap-2 rounded-full border border-[var(--color-acento)] bg-[var(--color-tarjeta)] py-2.5 pr-4 pl-3 shadow-xl"
        >
          <Timer size={18} className="text-[var(--color-acento)]" />
          <span className="font-mono text-base font-black tabular-nums">
            {reloj(valor)}
          </span>
        </button>
      </div>
    )
  }

  /* ------------------------------------------------------------- desplegada - */
  return (
    <div
      className="fixed inset-x-0 z-40 px-3 md:inset-x-auto md:right-6 md:w-[26rem] md:px-0"
      style={{ bottom: 'var(--hueco-nav)' }}
    >
      <div
        ref={cajaRef}
        className={cn(
          'relative overflow-hidden rounded-2xl border shadow-xl',
          t.terminado
            ? 'border-[var(--color-acento)] bg-[var(--color-acento)] text-white'
            : 'border-[var(--color-borde)] bg-[var(--color-tarjeta)]',
        )}
      >
        {!t.terminado && (
          <div
            className="absolute inset-y-0 left-0 bg-[var(--color-acento)]/15 transition-[width] duration-200"
            style={{ width: `${progreso}%` }}
            aria-hidden
          />
        )}

        <div className="relative p-3">
          {/* ---------------------------------------- contador y controles -- */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => !t.terminado && setMinimizado(true)}
              disabled={t.terminado}
              aria-label={t.terminado ? undefined : 'Minimizar el temporizador'}
              className="min-w-0 flex-1 text-left disabled:cursor-default"
            >
              <p
                className={cn(
                  'flex items-center gap-1.5 truncate text-[11px] font-bold tracking-wide uppercase',
                  t.terminado ? 'text-white/80' : 'text-[var(--color-suave)]',
                )}
              >
                {t.terminado && <BellRing size={13} />}
                {titulo}
                {t.etiqueta && ` · ${t.etiqueta}`}
              </p>
              <p className="font-mono text-3xl leading-none font-black tabular-nums">
                {reloj(valor)}
              </p>
            </button>

            <div className="flex shrink-0 items-center">
              {!t.terminado && (
                <>
                  <button
                    onClick={t.reiniciar}
                    aria-label="Volver a empezar"
                    className="grid size-10 place-items-center rounded-lg text-[var(--color-suave)]"
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={t.alternarPausa}
                    aria-label={t.pausado ? 'Reanudar' : 'Pausar'}
                    className="grid size-10 place-items-center rounded-lg text-[var(--color-suave)]"
                  >
                    {t.pausado ? <Play size={18} /> : <Pause size={18} />}
                  </button>
                </>
              )}
              <button
                onClick={t.cerrar}
                aria-label="Cerrar el temporizador"
                className={cn(
                  'grid size-10 place-items-center rounded-lg',
                  t.terminado ? 'text-white/80' : 'text-[var(--color-suave)]',
                )}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------ segunda fila -- */}
          {t.terminado ? (
            <button
              onClick={cerrarDandoPorBuena}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white/20 text-[15px] font-bold text-white"
            >
              <Check size={18} />
              {t.tarea
                ? `Hecha · descansar ${ajustes.descanso_seg}s`
                : 'Vale, seguimos'}
            </button>
          ) : !t.cuentaAtras ? (
            <button
              onClick={t.finalizar}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-acento)] text-[15px] font-bold text-[var(--color-acento)]"
            >
              <Square size={16} />
              Parar y guardar
            </button>
          ) : (
            <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => t.sumar(-15)}
                className="shrink-0 rounded-lg border border-[var(--color-borde)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-suave)]"
              >
                −15s
              </button>
              <button
                onClick={() => t.sumar(30)}
                className="shrink-0 rounded-lg border border-[var(--color-borde)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-suave)]"
              >
                +30s
              </button>

              {esDescanso && (
                <>
                  <span
                    className="mx-1 h-5 w-px shrink-0 bg-[var(--color-borde)]"
                    aria-hidden
                  />
                  {PRESETS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        cambiar({ descanso_seg: s })
                        t.fijarDuracion(s)
                      }}
                      className={cn(
                        'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold',
                        s === ajustes.descanso_seg
                          ? 'bg-[var(--color-acento)] text-white'
                          : 'text-[var(--color-suave)]',
                      )}
                    >
                      {s}s
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
