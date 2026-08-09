import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSameDay } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Info, SkipForward } from 'lucide-react'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import { listarSesiones } from '@/lib/datos'
import { aISO, fechasDeLaSemana, posicionEnPlan, prescripcionDe } from '@/lib/plan'
import { iconoDeDia } from '@/lib/iconos'
import { fechaCorta } from '@/lib/utils'
import { NOMBRES_DIA, type Sesion } from '@/lib/tipos'

export default function Semana() {
  const { plan, cargando } = usePlanActivo()
  const navegar = useNavigate()
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [sesiones, setSesiones] = useState<Sesion[]>([])

  const hoy = new Date()
  const referencia = useMemo(() => {
    const d = new Date(hoy)
    d.setDate(d.getDate() + desplazamiento * 7)
    return d
  }, [desplazamiento]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!plan) return
    void listarSesiones(plan.id).then(setSesiones)
  }, [plan])

  if (cargando || !plan) return <Cargando />

  const posicion = posicionEnPlan(plan, referencia)
  const fechas = fechasDeLaSemana(plan, referencia)
  const porFecha = new Map(sesiones.map((s) => [s.fecha, s]))

  const previstas = plan.estructura.dias.filter(
    (d) => d.tipo !== 'descanso',
  ).length
  const hechas = fechas.filter(
    (f) => porFecha.get(aISO(f))?.estado === 'hecha',
  ).length

  return (
    <>
      <EncabezadoPagina
        titulo={`Semana ${posicion.semana}`}
        subtitulo={`${posicion.nombreSemana} · ${hechas} de ${previstas} sesiones hechas`}
      />

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setDesplazamiento((d) => d - 1)}
          aria-label="Semana anterior"
          className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[var(--color-suave)]"
        >
          <ChevronLeft size={18} />
          Anterior
        </button>
        <span className="text-xs font-semibold text-[var(--color-suave)] tabular-nums">
          {fechaCorta(fechas[0])} – {fechaCorta(fechas[6])}
        </span>
        <button
          onClick={() => setDesplazamiento((d) => d + 1)}
          aria-label="Semana siguiente"
          className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-[var(--color-suave)]"
        >
          Siguiente
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-[var(--color-borde)]"
        role="progressbar"
        aria-valuenow={hechas}
        aria-valuemin={0}
        aria-valuemax={previstas}
      >
        <div
          className="h-full rounded-full bg-[var(--color-acento)] transition-[width]"
          style={{ width: `${previstas ? (hechas / previstas) * 100 : 0}%` }}
        />
      </div>

      <ul className="space-y-3">
        {fechas.map((f) => {
          const pos = posicionEnPlan(plan, f)
          const dia = pos.dia
          if (!dia) return null
          const Icono = iconoDeDia(dia)
          const sesion = porFecha.get(aISO(f))
          const esHoy = isSameDay(f, hoy)
          const descanso = dia.tipo === 'descanso'

          return (
            <li key={aISO(f)}>
              <button
                onClick={() => !descanso && navegar(`/sesion/${aISO(f)}`)}
                disabled={descanso}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  esHoy
                    ? 'border-[var(--color-acento)] bg-[var(--color-acento)]/10'
                    : 'border-[var(--color-borde)] bg-[var(--color-tarjeta)]'
                } ${descanso ? 'opacity-60' : 'hover:border-[var(--color-acento)]'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-xl bg-[var(--color-fondo)] p-2.5 text-[var(--color-acento)]">
                    <Icono size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">
                        {NOMBRES_DIA[dia.key]}
                      </span>
                      <span className="text-xs text-[var(--color-suave)] tabular-nums">
                        {fechaCorta(f)}
                      </span>
                      {esHoy && <Etiqueta tono="acento">Hoy</Etiqueta>}
                      {sesion?.estado === 'hecha' && (
                        <Etiqueta tono="ok">
                          <Check size={11} className="mr-1 inline" />
                          Hecha
                        </Etiqueta>
                      )}
                      {sesion?.estado === 'saltada' && (
                        <Etiqueta tono="aviso">
                          <SkipForward size={11} className="mr-1 inline" />
                          Saltada
                        </Etiqueta>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold">{dia.nombre}</p>
                    <p className="mt-1 text-xs text-[var(--color-suave)]">
                      {prescripcionDe(dia, pos.semana) || dia.enfoque}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {plan.estructura.avisos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-suave)] uppercase">
            <Info size={16} />
            Claves del plan
          </h2>
          <Tarjeta>
            <ul className="space-y-3">
              {plan.estructura.avisos.map((a) => (
                <li
                  key={a}
                  className="border-l-2 border-[var(--color-acento)] pl-3 text-sm leading-relaxed"
                >
                  {a}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </section>
      )}
    </>
  )
}
