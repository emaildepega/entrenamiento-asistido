import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarWeeks, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { History } from 'lucide-react'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Cargando, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import { historico, listarSesiones, type RegistroPasado } from '@/lib/datos'
import { actividadesStrava, esBici, type ActividadStrava } from '@/lib/strava'
import { local } from '@/lib/db'
import { fechaCorta } from '@/lib/utils'
import type { Sesion } from '@/lib/tipos'

const EJE = { fill: '#94a3b8', fontSize: 12 }
const CAJA_TOOLTIP = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 13,
}

export default function Progreso() {
  const { plan, cargando } = usePlanActivo()
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [slugs, setSlugs] = useState<{ slug: string; nombre: string }[]>([])
  const [elegido, setElegido] = useState('')
  const [registros, setRegistros] = useState<RegistroPasado[]>([])
  const [actividadesBici, setActividadesBici] = useState<ActividadStrava[]>([])

  useEffect(() => {
    void actividadesStrava().then((todas) =>
      setActividadesBici(todas.filter((a) => esBici(a.deporte))),
    )
    void listarSesiones().then(setSesiones)
    void local.series.toArray().then((series) => {
      const vistos = new Map<string, string>()
      for (const s of series) {
        if (s.hecha && !vistos.has(s.ejercicio_slug)) {
          vistos.set(s.ejercicio_slug, s.ejercicio_nombre)
        }
      }
      const lista = [...vistos.entries()].map(([slug, nombre]) => ({
        slug,
        nombre,
      }))
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setSlugs(lista)
      setElegido((actual) => actual || (lista[0]?.slug ?? ''))
    })
  }, [])

  useEffect(() => {
    if (!elegido) return setRegistros([])
    void historico(elegido, 20).then(setRegistros)
  }, [elegido])

  /* ---------------------------------------------- cumplimiento por semana -- */
  const cumplimiento = useMemo(() => {
    if (!plan) return []
    const previstas = plan.estructura.dias.filter(
      (d) => d.tipo !== 'descanso',
    ).length
    const hoy = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const atras = 3 - i
      const hechas = sesiones.filter((s) => {
        if (s.estado !== 'hecha') return false
        const semanas = differenceInCalendarWeeks(hoy, parseISO(s.fecha), {
          weekStartsOn: 1,
        })
        return semanas === atras
      }).length
      return {
        etiqueta: atras === 0 ? 'Esta' : `-${atras}`,
        hechas,
        previstas,
      }
    })
  }, [plan, sesiones])

  /* ------------------------------------------------------ fuerza elegida -- */
  /** Los que se aguantan se miden en segundos, no en kilos. */
  const esPorTiempo = useMemo(
    () => registros.some((r) => r.series.some((s) => (s.segundos ?? 0) > 0)),
    [registros],
  )

  const datosFuerza = useMemo(
    () =>
      [...registros]
        .reverse()
        .map((r) => {
          if (esPorTiempo) {
            const tiempos = r.series
              .map((s) => s.segundos ?? 0)
              .filter((x) => x > 0)
            return {
              fecha: fechaCorta(r.fecha),
              maximo: tiempos.length ? Math.max(...tiempos) : 0,
              volumen: tiempos.reduce((t, x) => t + x, 0),
            }
          }
          const pesos = r.series.map((s) => s.peso_kg ?? 0).filter((p) => p > 0)
          const volumen = r.series.reduce(
            (t, s) => t + (s.reps ?? 0) * (s.peso_kg ?? 0),
            0,
          )
          return {
            fecha: fechaCorta(r.fecha),
            maximo: pesos.length ? Math.max(...pesos) : 0,
            volumen: Math.round(volumen),
          }
        })
        .filter((d) => d.maximo > 0 || d.volumen > 0),
    [registros, esPorTiempo],
  )

  /* -------------------------------------------------------- horas de bici -- */
  /**
   * Si hay Strava conectado manda lo que dice Strava, que es lo que se rodó de
   * verdad. Las semanas en las que no haya nada suyo siguen contando lo
   * apuntado a mano, para no dejar huecos en el histórico de antes.
   */
  const horasBici = useMemo(() => {
    if (!plan) return []
    const tiposCardio = new Set(
      plan.estructura.dias
        .filter((d) => d.tipo === 'cardio' || d.tipo === 'salida')
        .map((d) => d.key),
    )
    const hoy = new Date()
    const semanaDe = (fechaISO: string) =>
      differenceInCalendarWeeks(hoy, parseISO(fechaISO), { weekStartsOn: 1 })

    return Array.from({ length: 8 }, (_, i) => {
      const atras = 7 - i

      const minutosStrava = actividadesBici
        .filter((a) => semanaDe(a.fecha_local) === atras)
        .reduce((t, a) => t + a.segundos_movimiento / 60, 0)

      const minutosAMano = sesiones
        .filter(
          (s) =>
            s.estado === 'hecha' &&
            tiposCardio.has(s.dia_key) &&
            semanaDe(s.fecha) === atras,
        )
        .reduce((t, s) => t + (s.duracion_min ?? 0), 0)

      const minutos = minutosStrava > 0 ? minutosStrava : minutosAMano
      return {
        etiqueta: atras === 0 ? 'Esta' : `-${atras}`,
        horas: Math.round((minutos / 60) * 10) / 10,
        deStrava: minutosStrava > 0,
      }
    })
  }, [plan, sesiones, actividadesBici])

  const algoDeStrava = horasBici.some((s) => s.deStrava)

  if (cargando || !plan) return <Cargando />

  const totalHechas = sesiones.filter((s) => s.estado === 'hecha').length

  return (
    <>
      <EncabezadoPagina
        titulo="Progreso"
        subtitulo={`${totalHechas} ${totalHechas === 1 ? 'sesión registrada' : 'sesiones registradas'} en total`}
        accion={
          <Link
            to="/historial"
            aria-label="Ver historial completo"
            className="rounded-xl bg-[var(--color-tarjeta)] p-2.5 text-[var(--color-suave)]"
          >
            <History size={20} />
          </Link>
        }
      />

      {totalHechas === 0 ? (
        <Tarjeta className="py-10 text-center text-sm text-[var(--color-suave)]">
          Todavía no hay nada que enseñar. Termina una sesión y aquí verás cómo
          evolucionas.
        </Tarjeta>
      ) : (
        <div className="space-y-6 xl:grid xl:grid-cols-2 xl:items-start xl:gap-6 xl:space-y-0">
          {/* ------------------------------------------------ cumplimiento */}
          <section>
            <h2 className="mb-2 text-sm font-bold text-[var(--color-suave)] uppercase">
              Cumplimiento (4 semanas)
            </h2>
            <Tarjeta>
              <div className="space-y-3">
                {cumplimiento.map((c) => (
                  <div key={c.etiqueta}>
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span className="text-[var(--color-suave)]">
                        {c.etiqueta === 'Esta' ? 'Esta semana' : `Hace ${c.etiqueta.slice(1)} sem.`}
                      </span>
                      <span className="tabular-nums">
                        {c.hechas}/{c.previstas}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-borde)]">
                      <div
                        className="h-full rounded-full bg-[var(--color-acento)]"
                        style={{
                          width: `${c.previstas ? Math.min(100, (c.hechas / c.previstas) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          </section>

          {/* ------------------------------------------------------ fuerza */}
          {slugs.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-bold text-[var(--color-suave)] uppercase">
                Fuerza por ejercicio
              </h2>
              <Tarjeta>
                <select
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  aria-label="Elegir ejercicio"
                  className="mb-4 min-h-12 w-full rounded-xl border border-[var(--color-borde)] bg-[var(--color-fondo)] px-3 text-[15px] text-[var(--color-texto)]"
                >
                  {slugs.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.nombre}
                    </option>
                  ))}
                </select>

                {datosFuerza.length < 2 ? (
                  <p className="py-6 text-center text-sm text-[var(--color-suave)]">
                    Necesitas al menos dos sesiones para ver la evolución.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={datosFuerza}
                      margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" tick={EJE} tickMargin={8} />
                      <YAxis tick={EJE} width={44} />
                      <Tooltip
                        contentStyle={CAJA_TOOLTIP}
                        labelStyle={{ color: '#f1f5f9' }}
                        formatter={(v, n) =>
                          n === 'maximo'
                            ? [
                                esPorTiempo ? `${v} s` : `${v} kg`,
                                esPorTiempo ? 'Mejor marca' : 'Peso máximo',
                              ]
                            : [
                                esPorTiempo ? `${v} s` : `${v}`,
                                esPorTiempo ? 'Tiempo total' : 'Volumen',
                              ]
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="maximo"
                        stroke="#f97316"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="volumen"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}

                <p className="mt-2 text-center text-xs text-[var(--color-suave)]">
                  <span className="text-[var(--color-acento)]">■</span>{' '}
                  {esPorTiempo ? 'mejor marca' : 'peso máximo'} ·{' '}
                  <span className="text-sky-400">■</span>{' '}
                  {esPorTiempo ? 'tiempo total' : 'volumen total'}
                </p>
              </Tarjeta>
            </section>
          )}

          {/* -------------------------------------------------- bici/horas */}
          <section className="xl:col-span-2">
            <h2 className="mb-2 text-sm font-bold text-[var(--color-suave)] uppercase">
              Horas de bici por semana
            </h2>
            <Tarjeta>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={horasBici}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="etiqueta" tick={EJE} tickMargin={8} />
                  <YAxis tick={EJE} width={44} />
                  <Tooltip
                    contentStyle={CAJA_TOOLTIP}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(v) => [`${v} h`, 'Bici']}
                  />
                  <Bar dataKey="horas" fill="#f97316" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-center text-xs text-[var(--color-suave)]">
                {algoDeStrava
                  ? 'Con lo que has rodado de verdad según Strava; las semanas sin salidas suyas cuentan lo que apuntaste a mano.'
                  : 'Solo cuenta lo que registras al terminar la sesión. Conecta Strava en Ajustes y se llenará solo.'}
              </p>
            </Tarjeta>
          </section>
        </div>
      )}
    </>
  )
}
