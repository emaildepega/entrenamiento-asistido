import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CirclePlay,
  History,
  Settings2,
  Undo2,
} from 'lucide-react'
import { AnimacionEjercicio } from './AnimacionEjercicio'
import { CampoTiempo } from './CampoTiempo'
import { SelectorAnimacion } from './SelectorAnimacion'
import { Campo, Etiqueta, Tarjeta } from './ui'
import {
  guardarMedia,
  guardarSerie,
  resumirRegistro,
  seriesDe,
  ultimaVez,
  type RegistroPasado,
} from '@/lib/datos'
import { medicionDe, seriesYRepsDe } from '@/lib/plan'
import { EVENTO_PENDIENTES, tomarPendientes } from '@/lib/seriePendiente'
import { pararAlarma } from '@/lib/alarma'
import { cn, fechaCorta } from '@/lib/utils'
import type { Ejercicio, Serie } from '@/lib/tipos'

interface Props {
  ejercicio: Ejercicio
  /** id del catálogo ya resuelto (contando correcciones manuales) */
  catalogoId: string | null
  prescripcion: string
  sesionId: string
  onSerieMarcada: () => void
  onMediaCambiada: () => void
}

export function TarjetaEjercicio({
  ejercicio,
  catalogoId,
  prescripcion,
  sesionId,
  onSerieMarcada,
  onMediaCambiada,
}: Props) {
  const [series, setSeries] = useState<Serie[]>([])
  const [anterior, setAnterior] = useState<RegistroPasado | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  const plantilla = useMemo(() => seriesYRepsDe(prescripcion), [prescripcion])
  const medicion = useMemo(
    () => medicionDe(ejercicio, prescripcion),
    [ejercicio, prescripcion],
  )

  useEffect(() => {
    let vivo = true
    const cargar = async () => {
      const guardadas = (await seriesDe(sesionId)).filter(
        (s) => s.ejercicio_slug === ejercicio.slug,
      )
      const previo = await ultimaVez(ejercicio.slug, sesionId)
      if (!vivo) return
      setAnterior(previo)

      const cuantas = ejercicio.series_objetivo ?? plantilla.series
      const filas: Serie[] = []
      for (let i = 1; i <= cuantas; i++) {
        const existente = guardadas.find((s) => s.serie === i)
        filas.push(
          existente ?? {
            id: crypto.randomUUID(),
            sesion_id: sesionId,
            ejercicio_slug: ejercicio.slug,
            ejercicio_nombre: ejercicio.nombre,
            serie: i,
            reps: null,
            peso_kg: null,
            segundos: null,
            hecha: false,
          },
        )
      }
      // Series extra que el usuario añadió en su día
      for (const g of guardadas) {
        if (g.serie > cuantas) filas.push(g)
      }

      // Este ejercicio se mide por tiempo, pero hay series apuntadas como
      // "1 × 30 kg" de cuando la app no lo distinguía: esos kilos eran
      // segundos, así que se pasan a su sitio.
      const arregladas =
        medicion === 'tiempo'
          ? filas.map((s) =>
              s.segundos === null && (s.peso_kg ?? 0) > 0
                ? { ...s, segundos: s.peso_kg, peso_kg: null, reps: null }
                : s,
            )
          : filas
      for (const s of arregladas) {
        const original = filas.find((f) => f.id === s.id)
        if (original && original !== s) await guardarSerie(s)
      }

      setSeries(arregladas.sort((a, b) => a.serie - b.serie))
    }
    void cargar()
    return () => {
      vivo = false
    }
  }, [
    sesionId,
    ejercicio.slug,
    ejercicio.nombre,
    ejercicio.series_objetivo,
    plantilla.series,
    medicion,
  ])

  // Series cronometradas que terminaron con la tarjeta fuera de pantalla (o con
  // la app recargada): en cuanto se ve, se dan por hechas con su tiempo.
  useEffect(() => {
    const aplicar = () => {
      if (series.length === 0) return
      const pendientes = tomarPendientes(sesionId, ejercicio.slug)
      if (pendientes.length === 0) return
      pararAlarma()
      const siguientes = series.map((s) => {
        const p = pendientes.find((x) => x.serie === s.serie)
        if (!p) return s
        // Un cero significa que la cuenta atrás se quedó sin tiempo por haberla
        // recortado, no que se aguantara cero: se respeta lo que ya hubiera.
        return {
          ...s,
          segundos: p.segundos > 0 ? p.segundos : s.segundos,
          hecha: true,
        }
      })
      setSeries(siguientes)
      for (const s of siguientes) {
        if (pendientes.some((p) => p.serie === s.serie)) void guardarSerie(s)
      }
    }
    aplicar()
    window.addEventListener(EVENTO_PENDIENTES, aplicar)
    return () => window.removeEventListener(EVENTO_PENDIENTES, aplicar)
  }, [series, sesionId, ejercicio.slug])

  const actualizar = async (serie: Serie, cambios: Partial<Serie>) => {
    const nueva = { ...serie, ...cambios }
    setSeries((prev) => prev.map((s) => (s.id === nueva.id ? nueva : s)))
    await guardarSerie(nueva)
  }

  const marcar = async (serie: Serie) => {
    const hecha = !serie.hecha
    // Si el aviso estaba sonando, marcar la serie es la forma natural de
    // callarlo: no hace falta buscar el botón de la barra.
    pararAlarma()
    const previa = anterior?.series[serie.serie - 1]
    // Lo que no se haya escrito se rellena con lo del plan o con lo de la
    // última vez: en mitad de una sesión no apetece teclear.
    const cambios: Partial<Serie> = { hecha }
    if (medicion === 'tiempo') {
      cambios.segundos =
        serie.segundos ??
        (hecha ? (plantilla.segundos ?? previa?.segundos ?? null) : null)
    } else {
      cambios.reps = serie.reps ?? (hecha ? plantilla.reps : null)
      if (medicion === 'reps_peso') {
        cambios.peso_kg =
          serie.peso_kg ?? (hecha ? (previa?.peso_kg ?? null) : null)
      }
    }
    await actualizar(serie, cambios)
    if (hecha) onSerieMarcada()
  }

  const hechas = series.filter((s) => s.hecha).length

  return (
    <Tarjeta className="p-0">
      <AnimacionEjercicio
        catalogoId={catalogoId}
        nombre={ejercicio.nombre}
        ratio="aspect-[16/10]"
        className="rounded-b-none"
        onFalta={() => setSelectorAbierto(true)}
      />

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="text-lg leading-tight font-bold">{ejercicio.nombre}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {ejercicio.youtube_id && (
              <a
                href={`https://www.youtube.com/watch?v=${ejercicio.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Ver vídeo de ${ejercicio.nombre}`}
                title="Ver el vídeo en YouTube"
                className="rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
              >
                <CirclePlay size={20} />
              </a>
            )}
            <Link
              to={`/ejercicio/${ejercicio.slug}`}
              aria-label={`Ver el histórico de ${ejercicio.nombre}`}
              title="Ver cuánto levantaste otras veces"
              className="rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            >
              <History size={18} />
            </Link>
            <button
              onClick={() => setSelectorAbierto(true)}
              aria-label={`Cambiar animación de ${ejercicio.nombre}`}
              title="Cambiar la animación de este ejercicio"
              className="rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {prescripcion && (
          <p className="text-sm text-[var(--color-suave)]">{prescripcion}</p>
        )}

        <p className="mt-2 text-xs font-semibold text-[var(--color-suave)]">
          {anterior ? (
            <>
              La última vez ({fechaCorta(anterior.fecha)}):{' '}
              <span className="text-[var(--color-acento)]">
                {resumirRegistro(anterior)}
              </span>
            </>
          ) : (
            'Primera vez con este ejercicio'
          )}
        </p>

        <div className="mt-3 space-y-2">
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-sm font-bold text-[var(--color-suave)] tabular-nums">
                {s.serie}
              </span>
              {medicion === 'tiempo' ? (
                <CampoTiempo
                  valor={s.segundos}
                  objetivo={
                    plantilla.segundos ??
                    anterior?.series[s.serie - 1]?.segundos ??
                    null
                  }
                  onCambiar={(segundos) => void actualizar(s, { segundos })}
                  etiqueta={`Tiempo aguantado en la serie ${s.serie}`}
                  nombreEjercicio={ejercicio.nombre}
                  tarea={{
                    sesionId,
                    slug: ejercicio.slug,
                    serie: s.serie,
                  }}
                />
              ) : (
                <>
                  <Campo
                    type="number"
                    inputMode="numeric"
                    placeholder={
                      plantilla.reps ? String(plantilla.reps) : 'reps'
                    }
                    value={s.reps ?? ''}
                    onChange={(e) =>
                      void actualizar(s, {
                        reps:
                          e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    aria-label={`Repeticiones de la serie ${s.serie}`}
                    className="min-h-11 flex-1 text-center"
                  />
                  {medicion === 'reps_peso' && (
                    <>
                      <span className="text-xs text-[var(--color-suave)]">
                        ×
                      </span>
                      <Campo
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        placeholder="kg"
                        value={s.peso_kg ?? ''}
                        onChange={(e) =>
                          void actualizar(s, {
                            peso_kg:
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        aria-label={`Peso de la serie ${s.serie}`}
                        className="min-h-11 flex-1 text-center"
                      />
                    </>
                  )}
                </>
              )}
              <button
                onClick={() => void marcar(s)}
                aria-label={
                  s.hecha
                    ? `Deshacer la serie ${s.serie}`
                    : `Marcar serie ${s.serie} como hecha`
                }
                title={
                  s.hecha
                    ? 'Toca otra vez para deshacerla'
                    : 'Marcar como hecha'
                }
                aria-pressed={s.hecha}
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl border transition',
                  s.hecha
                    ? 'border-green-500 bg-green-500 text-white hover:border-amber-400 hover:bg-amber-500'
                    : 'border-[var(--color-borde)] text-[var(--color-suave)]',
                )}
              >
                <Check size={20} />
              </button>
            </div>
          ))}
        </div>

        {hechas > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Etiqueta tono={hechas === series.length ? 'ok' : 'acento'}>
              {hechas} de {series.length} series
            </Etiqueta>
            <span className="inline-flex items-center gap-1 text-xs text-[var(--color-suave)]">
              <Undo2 size={12} />
              Toca una serie verde para deshacerla
            </span>
          </div>
        )}
      </div>

      <SelectorAnimacion
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        nombreEjercicio={ejercicio.nombre}
        catalogoActual={catalogoId}
        onElegir={async (id) => {
          await guardarMedia({
            ejercicio_slug: ejercicio.slug,
            catalogo_id: id,
            youtube_id: ejercicio.youtube_id,
          })
          onMediaCambiada()
        }}
      />
    </Tarjeta>
  )
}
