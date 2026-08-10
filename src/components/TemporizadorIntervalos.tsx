import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, X } from 'lucide-react'
import { Boton } from './ui'
import { pitidoCorto } from '@/lib/alarma'
import { reloj } from '@/lib/utils'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { Intervalo } from '@/lib/tipos'

type Fase = 'calentamiento' | 'trabajo' | 'recuperacion' | 'fin'

interface Tramo {
  fase: Fase
  segundos: number
  serie: number
}

function construirTramos(iv: Intervalo, calentamientoMin: number): Tramo[] {
  const tramos: Tramo[] = []
  if (calentamientoMin > 0) {
    tramos.push({ fase: 'calentamiento', segundos: calentamientoMin * 60, serie: 0 })
  }
  for (let i = 1; i <= iv.series; i++) {
    tramos.push({ fase: 'trabajo', segundos: iv.trabajo_min * 60, serie: i })
    if (i < iv.series) {
      tramos.push({
        fase: 'recuperacion',
        segundos: iv.descanso_min * 60,
        serie: i,
      })
    }
  }
  return tramos
}

const ESTILO_FASE: Record<Fase, { fondo: string; texto: string; etiqueta: string }> = {
  calentamiento: {
    fondo: 'bg-slate-700',
    texto: 'text-slate-100',
    etiqueta: 'Calentamiento',
  },
  trabajo: { fondo: 'bg-orange-600', texto: 'text-white', etiqueta: 'FUERTE' },
  recuperacion: {
    fondo: 'bg-sky-800',
    texto: 'text-sky-50',
    etiqueta: 'Recuperación',
  },
  fin: { fondo: 'bg-green-700', texto: 'text-white', etiqueta: 'Terminado' },
}

/**
 * Temporizador de intervalos a pantalla completa para los días de bici.
 * Vibra en cada cambio de fase y mantiene la pantalla encendida.
 */
export function TemporizadorIntervalos({
  intervalo,
  calentamientoMin = 15,
  onCerrar,
}: {
  intervalo: Intervalo
  calentamientoMin?: number
  onCerrar: () => void
}) {
  const [tramos] = useState(() => construirTramos(intervalo, calentamientoMin))
  const [indice, setIndice] = useState(0)
  const [restante, setRestante] = useState(tramos[0]?.segundos ?? 0)
  const [corriendo, setCorriendo] = useState(false)
  const finRef = useRef(0)

  useWakeLock(corriendo)

  const tramo = tramos[indice]
  const terminado = indice >= tramos.length
  const fase: Fase = terminado ? 'fin' : tramo.fase
  const estilo = ESTILO_FASE[fase]

  const avanzar = () => {
    pitidoCorto(fase !== 'trabajo')
    const siguiente = indice + 1
    setIndice(siguiente)
    if (siguiente < tramos.length) {
      finRef.current = Date.now() + tramos[siguiente].segundos * 1000
      setRestante(tramos[siguiente].segundos)
    } else {
      setCorriendo(false)
      setRestante(0)
    }
  }

  useEffect(() => {
    if (!corriendo || terminado) return
    const tick = () => {
      const quedan = Math.max(0, (finRef.current - Date.now()) / 1000)
      setRestante(quedan)
      if (quedan <= 0) avanzar()
    }
    tick()
    const t = setInterval(tick, 200)
    return () => clearInterval(t)
    // avanzar depende de indice; el efecto se reengancha en cada tramo
  }, [corriendo, indice, terminado]) // eslint-disable-line react-hooks/exhaustive-deps

  const arrancar = () => {
    finRef.current = Date.now() + restante * 1000
    setCorriendo(true)
  }

  const seriesTotales = intervalo.series
  const serieActual = terminado ? seriesTotales : tramo.serie

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${estilo.fondo} ${estilo.texto}`}
    >
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-bold tracking-wide uppercase opacity-80">
          {estilo.etiqueta}
        </span>
        <button onClick={onCerrar} aria-label="Cerrar temporizador" className="p-2">
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        {serieActual > 0 && (
          <p className="text-lg font-bold opacity-90">
            Serie {serieActual} de {seriesTotales}
          </p>
        )}
        <p className="font-mono text-7xl leading-none font-black tabular-nums sm:text-8xl">
          {reloj(restante)}
        </p>
        {terminado ? (
          <p className="text-center text-lg font-semibold">
            Intervalos completados. Vuelta a casa suave.
          </p>
        ) : (
          <p className="text-center text-sm opacity-80">
            {intervalo.series}×{intervalo.trabajo_min} min con{' '}
            {intervalo.descanso_min} min de recuperación
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 p-6 pb-10">
        {!terminado && (
          <>
            <Boton
              variante="secundario"
              onClick={() => (corriendo ? setCorriendo(false) : arrancar())}
              className="min-w-36"
            >
              {corriendo ? <Pause size={20} /> : <Play size={20} />}
              {corriendo ? 'Pausar' : restante === tramos[indice]?.segundos ? 'Empezar' : 'Seguir'}
            </Boton>
            <Boton variante="secundario" onClick={avanzar} aria-label="Saltar tramo">
              <SkipForward size={20} />
              Saltar
            </Boton>
          </>
        )}
        {terminado && (
          <Boton variante="secundario" onClick={onCerrar} className="min-w-48">
            Cerrar
          </Boton>
        )}
      </div>
    </div>
  )
}
