import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import {
  ArrowLeft,
  Check,
  CirclePlay,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { AnimacionEjercicio } from '@/components/AnimacionEjercicio'
import { SelectorAnimacion } from '@/components/SelectorAnimacion'
import { SelectorEjercicio } from '@/components/SelectorEjercicio'
import { SelectorFecha } from '@/components/SelectorFecha'
import {
  AreaTexto,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  Tarjeta,
} from '@/components/ui'
import { activarPlan, guardarPlan, listarPlanes } from '@/lib/datos'
import { aISO } from '@/lib/plan'
import { siguienteLunes } from '@/lib/seed'
import { iconoDeDia } from '@/lib/iconos'
import { cn, fechaCorta } from '@/lib/utils'
import {
  DIAS_KEYS,
  NOMBRES_DIA,
  type Dia,
  type Plan,
  type TipoDia,
} from '@/lib/tipos'

const TIPOS: { valor: TipoDia; etiqueta: string }[] = [
  { valor: 'gimnasio', etiqueta: 'Sala / fuerza' },
  { valor: 'cardio', etiqueta: 'Cardio' },
  { valor: 'salida', etiqueta: 'Salida larga' },
  { valor: 'descanso', etiqueta: 'Descanso' },
]

function planVacio(): Plan {
  return {
    id: crypto.randomUUID(),
    nombre: 'Plan nuevo',
    descripcion: '',
    semanas: 4,
    fecha_inicio: aISO(siguienteLunes()),
    activo: false,
    created_at: new Date().toISOString(),
    estructura: {
      semanas: 4,
      nombres_semana: ['Adaptación', 'Carga', 'Pico', 'Descarga'],
      avisos: [],
      dias: DIAS_KEYS.map((key) => ({
        key,
        nombre: key === 'domingo' ? 'Descanso' : '',
        tipo: key === 'domingo' ? ('descanso' as TipoDia) : ('gimnasio' as TipoDia),
        ejercicios: [],
        prescripcion: {},
      })),
    },
  }
}

export default function PlanDetalle() {
  const { id = '' } = useParams()
  const navegar = useNavigate()
  const esNuevo = id === 'nuevo'

  const [plan, setPlan] = useState<Plan | null>(null)
  const [editando, setEditando] = useState(esNuevo)
  const [semanaVista, setSemanaVista] = useState(1)
  const [anadiendoEn, setAnadiendoEn] = useState<number | null>(null)
  const [cambiandoAnimacion, setCambiandoAnimacion] = useState<{
    dia: number
    ej: number
  } | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    // React Router reutiliza el componente al pasar de /plan/xxx a /plan/nuevo,
    // así que el modo se decide aquí y no solo en el estado inicial.
    setEditando(esNuevo)
    setSemanaVista(1)

    if (esNuevo) {
      setPlan(planVacio())
      return
    }
    void listarPlanes().then((planes) => {
      const encontrado = planes.find((p) => p.id === id)
      if (!encontrado) {
        toast.error('Ese plan ya no existe')
        navegar('/planes')
        return
      }
      setPlan(encontrado)
    })
  }, [id, esNuevo, navegar])

  const cambiar = useCallback((cambios: Partial<Plan>) => {
    setPlan((p) => (p ? { ...p, ...cambios } : p))
  }, [])

  const cambiarDia = useCallback((indice: number, cambios: Partial<Dia>) => {
    setPlan((p) => {
      if (!p) return p
      const dias = [...p.estructura.dias]
      dias[indice] = { ...dias[indice], ...cambios }
      return { ...p, estructura: { ...p.estructura, dias } }
    })
  }, [])

  const semanas = useMemo(
    () => (plan ? Array.from({ length: plan.semanas }, (_, i) => i + 1) : []),
    [plan],
  )

  if (!plan) return <Cargando />

  const guardar = async (activar: boolean) => {
    setGuardando(true)
    try {
      const limpio: Plan = {
        ...plan,
        nombre: plan.nombre.trim() || 'Plan sin nombre',
        estructura: {
          ...plan.estructura,
          semanas: plan.semanas,
          nombres_semana: semanas.map(
            (s) => plan.estructura.nombres_semana[s - 1] ?? `Semana ${s}`,
          ),
          dias: plan.estructura.dias.map((d) => ({
            ...d,
            nombre: d.nombre.trim() || NOMBRES_DIA[d.key],
          })),
        },
      }
      await guardarPlan(limpio)
      if (activar) await activarPlan(limpio.id)
      toast.success(activar ? `«${limpio.nombre}» activado` : 'Plan guardado')
      setEditando(false)
      if (esNuevo) navegar(`/plan/${limpio.id}`, { replace: true })
      else setPlan(limpio)
    } finally {
      setGuardando(false)
    }
  }

  const totalEjercicios = plan.estructura.dias.reduce(
    (t, d) => t + d.ejercicios.length,
    0,
  )
  const sesiones = plan.estructura.dias.filter((d) => d.tipo !== 'descanso').length

  return (
    <>
      <Link
        to="/planes"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-suave)]"
      >
        <ArrowLeft size={16} />
        Planes
      </Link>

      <EncabezadoPagina
        titulo={esNuevo ? 'Plan nuevo' : plan.nombre}
        subtitulo={`${plan.semanas} ${plan.semanas === 1 ? 'semana' : 'semanas'} · ${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'} por semana · ${totalEjercicios} ${totalEjercicios === 1 ? 'ejercicio' : 'ejercicios'}`}
        accion={
          !editando ? (
            <Boton variante="secundario" onClick={() => setEditando(true)}>
              <Pencil size={18} />
              Editar
            </Boton>
          ) : undefined
        }
      />

      {/* ------------------------------------------------ datos del plan */}
      {editando && (
        <Tarjeta className="mb-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
              Nombre
            </label>
            <Campo
              value={plan.nombre}
              onChange={(e) => cambiar({ nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
              Descripción
            </label>
            <AreaTexto
              rows={2}
              value={plan.descripcion}
              onChange={(e) => cambiar({ descripcion: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
                Semanas del bloque
              </label>
              <Campo
                type="number"
                inputMode="numeric"
                min={1}
                max={52}
                value={plan.semanas}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(52, Number(e.target.value) || 1))
                  cambiar({ semanas: n })
                  if (semanaVista > n) setSemanaVista(n)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
                El bloque empieza
              </label>
              <SelectorFecha
                valor={parseISO(plan.fecha_inicio)}
                onCambiar={(f) => cambiar({ fecha_inicio: aISO(f) })}
                etiqueta="Inicio del bloque"
              />
            </div>
          </div>
        </Tarjeta>
      )}

      {!editando && plan.descripcion && (
        <p className="mb-4 text-sm text-[var(--color-suave)]">
          {plan.descripcion} · empieza el {fechaCorta(plan.fecha_inicio)}
        </p>
      )}

      {/* ------------------------------------------------ elegir semana */}
      {plan.semanas > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {semanas.map((s) => (
            <button
              key={s}
              onClick={() => setSemanaVista(s)}
              className={cn(
                'min-h-10 rounded-xl px-3 text-sm font-bold transition',
                semanaVista === s
                  ? 'bg-[var(--color-acento)] text-white'
                  : 'bg-[var(--color-tarjeta)] text-[var(--color-suave)] hover:text-[var(--color-texto)]',
              )}
            >
              S{s}
              <span className="ml-1 font-normal opacity-80">
                {plan.estructura.nombres_semana[s - 1] ?? ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- días */}
      <div className="grid gap-3 lg:grid-cols-2">
        {plan.estructura.dias.map((dia, di) => {
          const Icono = iconoDeDia(dia)
          return (
            <Tarjeta key={dia.key}>
              <div className="mb-3 flex items-start gap-3">
                <span className="rounded-xl bg-[var(--color-fondo)] p-2.5 text-[var(--color-acento)]">
                  <Icono size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--color-suave)] uppercase">
                    {NOMBRES_DIA[dia.key]}
                  </p>
                  {editando ? (
                    <Campo
                      value={dia.nombre}
                      onChange={(e) =>
                        cambiarDia(di, { nombre: e.target.value })
                      }
                      placeholder="Nombre de la sesión"
                      className="mt-1 min-h-11"
                    />
                  ) : (
                    <p className="font-bold">
                      {dia.nombre || NOMBRES_DIA[dia.key]}
                    </p>
                  )}
                </div>
                {!editando && (
                  <Etiqueta tono={dia.tipo === 'descanso' ? 'neutro' : 'acento'}>
                    {TIPOS.find((t) => t.valor === dia.tipo)?.etiqueta}
                  </Etiqueta>
                )}
              </div>

              {editando && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <select
                    value={dia.tipo}
                    onChange={(e) =>
                      cambiarDia(di, { tipo: e.target.value as TipoDia })
                    }
                    aria-label={`Tipo de sesión del ${NOMBRES_DIA[dia.key]}`}
                    className="min-h-12 rounded-xl border border-[var(--color-borde)] bg-[var(--color-fondo)] px-3 text-[15px] text-[var(--color-texto)]"
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </select>
                  <Campo
                    value={dia.enfoque ?? ''}
                    onChange={(e) => cambiarDia(di, { enfoque: e.target.value })}
                    placeholder="Enfoque (opcional)"
                  />
                </div>
              )}

              {dia.tipo !== 'descanso' && (
                <>
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-bold text-[var(--color-suave)] uppercase">
                      Semana {semanaVista}
                    </p>
                    {editando ? (
                      <Campo
                        value={dia.prescripcion?.[String(semanaVista)] ?? ''}
                        onChange={(e) =>
                          cambiarDia(di, {
                            prescripcion: {
                              ...dia.prescripcion,
                              [String(semanaVista)]: e.target.value,
                            },
                          })
                        }
                        placeholder="3×10 con peso cómodo"
                      />
                    ) : (
                      <p className="text-sm">
                        {dia.prescripcion?.[String(semanaVista)] || (
                          <span className="text-[var(--color-suave)]">
                            Sin indicar
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {dia.ejercicios.length > 0 && (
                    <ul className="space-y-2">
                      {dia.ejercicios.map((ej, ei) => (
                        <li
                          key={`${ej.slug}-${ei}`}
                          className="flex items-center gap-3 rounded-xl border border-[var(--color-borde)] p-2"
                        >
                          <div className="w-14 shrink-0">
                            <AnimacionEjercicio
                              catalogoId={ej.catalogo_id}
                              nombre={ej.nombre}
                              ratio="aspect-square"
                            />
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">
                              {ej.nombre}
                            </span>
                            <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-bold text-[var(--color-suave)]">
                              {!ej.catalogo_id && <span>sin animación</span>}
                              {ej.youtube_id ? (
                                <a
                                  href={`https://www.youtube.com/watch?v=${ej.youtube_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 underline hover:text-[var(--color-acento)]"
                                >
                                  <CirclePlay size={12} />
                                  vídeo
                                </a>
                              ) : (
                                <span>sin vídeo</span>
                              )}
                            </span>
                          </span>
                          {editando && (
                            <>
                              <button
                                onClick={() =>
                                  setCambiandoAnimacion({ dia: di, ej: ei })
                                }
                                aria-label={`Cambiar animación de ${ej.nombre}`}
                                className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
                              >
                                <Settings2 size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  cambiarDia(di, {
                                    ejercicios: dia.ejercicios.filter(
                                      (_, i) => i !== ei,
                                    ),
                                  })
                                }
                                aria-label={`Quitar ${ej.nombre}`}
                                className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {editando && (
                    <Boton
                      variante="secundario"
                      className="mt-2 w-full"
                      onClick={() => setAnadiendoEn(di)}
                    >
                      <Plus size={18} />
                      Añadir ejercicio
                    </Boton>
                  )}

                  {!editando && dia.ejercicios.length === 0 && (
                    <p className="text-sm text-[var(--color-suave)]">
                      Sin ejercicios de sala.
                    </p>
                  )}
                </>
              )}
            </Tarjeta>
          )
        })}
      </div>

      {/* ------------------------------------------------------ guardar */}
      {editando && (
        <div className="sticky bottom-20 mt-4 flex gap-2 rounded-2xl border border-[var(--color-borde)] bg-[var(--color-tarjeta)] p-3 md:bottom-4">
          <Boton
            className="flex-1"
            disabled={guardando}
            onClick={() => void guardar(true)}
          >
            <Check size={18} />
            Guardar y activar
          </Boton>
          <Boton
            variante="secundario"
            disabled={guardando}
            onClick={() => void guardar(false)}
          >
            Solo guardar
          </Boton>
          {!esNuevo && (
            <Boton variante="fantasma" onClick={() => window.location.reload()}>
              Descartar
            </Boton>
          )}
        </div>
      )}

      <SelectorEjercicio
        abierto={anadiendoEn !== null}
        onCerrar={() => setAnadiendoEn(null)}
        onElegir={(ej) => {
          if (anadiendoEn === null) return
          const dia = plan.estructura.dias[anadiendoEn]
          cambiarDia(anadiendoEn, { ejercicios: [...dia.ejercicios, ej] })
        }}
      />

      {cambiandoAnimacion && (
        <SelectorAnimacion
          abierto
          onCerrar={() => setCambiandoAnimacion(null)}
          nombreEjercicio={
            plan.estructura.dias[cambiandoAnimacion.dia].ejercicios[
              cambiandoAnimacion.ej
            ].nombre
          }
          catalogoActual={
            plan.estructura.dias[cambiandoAnimacion.dia].ejercicios[
              cambiandoAnimacion.ej
            ].catalogo_id
          }
          onElegir={(idCat) => {
            const dia = plan.estructura.dias[cambiandoAnimacion.dia]
            const ejercicios = [...dia.ejercicios]
            ejercicios[cambiandoAnimacion.ej] = {
              ...ejercicios[cambiandoAnimacion.ej],
              catalogo_id: idCat,
            }
            cambiarDia(cambiandoAnimacion.dia, { ejercicios })
          }}
        />
      )}
    </>
  )
}
