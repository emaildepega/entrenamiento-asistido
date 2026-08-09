import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { reloj, vibrar } from '@/lib/utils'

/**
 * Barra flotante de descanso entre series. Arranca sola al marcar una serie.
 * Cuenta con el reloj del sistema, no sumando ticks, para que no se desfase si
 * el navegador ralentiza el temporizador con la pantalla apagada.
 */
export function TemporizadorDescanso({
  segundos,
  onCambiarSegundos,
  arrancarEn,
  onCerrar,
}: {
  segundos: number
  onCambiarSegundos: (s: number) => void
  /** timestamp del último arranque; cambiarlo reinicia la cuenta */
  arrancarEn: number | null
  onCerrar: () => void
}) {
  const [restante, setRestante] = useState(segundos)
  const [pausado, setPausado] = useState(false)
  const finRef = useRef<number>(0)
  const avisadoRef = useRef(false)

  useEffect(() => {
    if (arrancarEn === null) return
    finRef.current = arrancarEn + segundos * 1000
    avisadoRef.current = false
    setPausado(false)
    setRestante(segundos)
  }, [arrancarEn, segundos])

  useEffect(() => {
    if (arrancarEn === null || pausado) return
    const tick = () => {
      const quedan = Math.max(0, (finRef.current - Date.now()) / 1000)
      setRestante(quedan)
      if (quedan <= 0 && !avisadoRef.current) {
        avisadoRef.current = true
        vibrar([220, 90, 220])
      }
    }
    tick()
    const t = setInterval(tick, 200)
    return () => clearInterval(t)
  }, [arrancarEn, pausado])

  if (arrancarEn === null) return null

  const terminado = restante <= 0
  const progreso = Math.min(100, ((segundos - restante) / segundos) * 100)

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-20 z-40 px-4 md:inset-x-auto md:right-6 md:bottom-6 md:w-[30rem] md:px-0">
      <div
        className={`relative overflow-hidden rounded-2xl border shadow-lg ${
          terminado
            ? 'border-green-500 bg-green-500/15'
            : 'border-[var(--color-borde)] bg-[var(--color-tarjeta)]'
        }`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-[var(--color-acento)]/20 transition-[width] duration-200"
          style={{ width: `${progreso}%` }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--color-suave)]">
              {terminado ? '¡Vamos a por la siguiente!' : 'Descanso'}
            </p>
            <p className="font-mono text-2xl leading-tight font-black tabular-nums">
              {reloj(restante)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {[60, 90, 120, 180].map((s) => (
              <button
                key={s}
                onClick={() => onCambiarSegundos(s)}
                className={`rounded-lg px-2 py-1.5 text-xs font-bold ${
                  s === segundos
                    ? 'bg-[var(--color-acento)] text-white'
                    : 'text-[var(--color-suave)]'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              finRef.current = Date.now() + segundos * 1000
              avisadoRef.current = false
              setRestante(segundos)
              setPausado(false)
            }}
            aria-label="Reiniciar descanso"
            className="rounded-lg p-2 text-[var(--color-suave)]"
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={() => {
              if (pausado) finRef.current = Date.now() + restante * 1000
              setPausado((p) => !p)
            }}
            aria-label={pausado ? 'Reanudar' : 'Pausar'}
            className="rounded-lg p-2 text-[var(--color-suave)]"
          >
            {pausado ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button
            onClick={onCerrar}
            aria-label="Cerrar temporizador"
            className="rounded-lg p-2 text-[var(--color-suave)]"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
