import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  Flag,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { TarjetaEjercicio } from '@/components/TarjetaEjercicio'
import { TemporizadorDescanso } from '@/components/TemporizadorDescanso'
import { TemporizadorIntervalos } from '@/components/TemporizadorIntervalos'
import { AreaTexto, Boton, Campo, Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import { useAjustes } from '@/hooks/useAjustes'
import { useWakeLock } from '@/hooks/useWakeLock'
import {
  abrirSesion,
  cerrarSesion,
  guardarPlan,
  todasLasMedias,
} from '@/lib/datos'
import {
  aISO,
  intervaloDe,
  posicionEnPlan,
  prescripcionDe,
} from '@/lib/plan'
import { siguienteLunes } from '@/lib/seed'
import { iconoDeDia } from '@/lib/iconos'
import { fechaCorta, fechaLarga } from '@/lib/utils'
import type { MediaEjercicio, Sesion } from '@/lib/tipos'

export default function Hoy() {
  const { fecha: fechaParam } = useParams()
  const navegar = useNavigate()
  const { plan, cargando, recargar } = usePlanActivo()

  const fecha = useMemo(
    () => (fechaParam ? parseISO(fechaParam) : new Date()),
    [fechaParam],
  )

  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [medias, setMedias] = useState<MediaEjercicio[]>([])
  const { ajustes, cambiar: cambiarAjustes } = useAjustes()
  const [arrancarDescanso, setArrancarDescanso] = useState<number | null>(null)
  const [intervalosAbiertos, setIntervalosAbiertos] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [duracion, setDuracion] = useState('')
  const [notas, setNotas] = useState('')

  const posicion = useMemo(
    () => (plan ? posicionEnPlan(plan, fecha) : null),
    [plan, fecha],
  )
  const dia = posicion?.dia ?? null

  const cargarMedias = useCallback(async () => {
    setMedias(await todasLasMedias())
  }, [])

  useEffect(() => {
    void cargarMedias()
  }, [cargarMedias])

  useEffect(() => {
    if (!plan || !posicion || !dia || dia.tipo === 'descanso') {
      setSesion(null)
      return
    }
    let vivo = true
    void abrirSesion(plan.id, aISO(fecha), posicion.diaKey, posicion.semana).then(
      (s) => {
        if (!vivo) return
        setSesion(s)
        setDuracion(s.duracion_min ? String(s.duracion_min) : '')
        setNotas(s.notas ?? '')
      },
    )
    return () => {
      vivo = false
    }
  }, [plan, posicion, dia, fecha])

  // Mientras la sesión está abierta y no cerrada, la pantalla no se apaga
  useWakeLock(sesion !== null && sesion.estado === 'parcial')

  const catalogoDe = useCallback(
    (slug: string, porDefecto: string | null) => {
      const media = medias.find((m) => m.ejercicio_slug === slug)
      return media ? media.catalogo_id : porDefecto
    },
    [medias],
  )

  if (cargando) return <Cargando />

  // Con cuenta se empieza vacío: no se inventa ningún plan por su cuenta
  if (!plan || !posicion) {
    return (
      <>
        <EncabezadoPagina
          titulo={fechaLarga(fecha)}
          subtitulo="Todavía no tienes ningún plan"
        />
        <Tarjeta className="py-10 text-center">
          <ClipboardList
            className="mx-auto mb-3 text-[var(--color-suave)]"
            size={32}
          />
          <p className="font-semibold">Aquí verás qué te toca cada día</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-suave)]">
            En cuanto tengas un plan activo, esta pantalla te dirá la sesión del
            día con sus ejercicios y su animación.
          </p>
          <Link to="/planes">
            <Boton className="mt-4">Añadir un plan</Boton>
          </Link>
        </Tarjeta>
      </>
    )
  }

  const Icono = dia ? iconoDeDia(dia) : Flag

  /* ------------------------------------------------------ antes de empezar - */
  if (posicion.antesDeEmpezar) {
    return (
      <>
        <EncabezadoPagina
          titulo={fechaLarga(fecha)}
          subtitulo={plan.nombre}
        />
        <Tarjeta className="text-center">
          <CalendarPlus className="mx-auto mb-3 text-[var(--color-acento)]" size={32} />
          <p className="font-semibold">
            El bloque empieza el {fechaCorta(plan.fecha_inicio)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-suave)]">
            Puedes cambiar la fecha de inicio desde Planes.
          </p>
          <Link to="/planes">
            <Boton variante="secundario" className="mt-4">
              Ir a Planes
            </Boton>
          </Link>
        </Tarjeta>
      </>
    )
  }

  const prescripcion = dia ? prescripcionDe(dia, posicion.semana) : ''
  const intervalo = dia ? intervaloDe(dia, posicion.semana) : null
  const tieneEjercicios = (dia?.ejercicios?.length ?? 0) > 0

  const terminarSesion = async () => {
    if (!sesion) return
    const min = duracion === '' ? null : Number(duracion)
    await cerrarSesion(sesion, 'hecha', min, notas || null)
    setSesion({ ...sesion, estado: 'hecha', duracion_min: min, notas: notas || null })
    setCerrando(false)
    toast.success('Sesión guardada')
  }

  const empezarBloqueNuevo = async () => {
    const inicio = siguienteLunes()
    await guardarPlan({ ...plan, fecha_inicio: aISO(inicio), activo: true })
    await recargar()
    toast.success(`Bloque nuevo desde el ${fechaCorta(inicio)}`)
  }

  return (
    <>
      <EncabezadoPagina
        titulo={fechaLarga(fecha)}
        subtitulo={
          dia
            ? `Semana ${posicion.semana} · ${posicion.nombreSemana} · ${dia.nombre}${
                dia.hora_inicio ? ` · ${dia.hora_inicio}–${dia.hora_fin}` : ''
              }`
            : plan.nombre
        }
        accion={
          <span className="rounded-xl bg-[var(--color-acento)]/15 p-2.5 text-[var(--color-acento)]">
            <Icono size={22} />
          </span>
        }
      />

      {posicion.bloqueTerminado && (
        <Tarjeta className="mb-4 border-[var(--color-acento)]/40 bg-[var(--color-acento)]/10">
          <p className="font-bold">Bloque terminado</p>
          <p className="mt-1 text-sm text-[var(--color-suave)]">
            Has completado las {plan.semanas} semanas. Arranca el siguiente
            empezando la semana 1 con los pesos que usaste en la semana 2.
          </p>
          <Boton className="mt-3" onClick={() => void empezarBloqueNuevo()}>
            Empezar bloque nuevo
          </Boton>
        </Tarjeta>
      )}

      {dia?.aviso && (
        <Tarjeta className="mb-4 flex gap-3 border-amber-500/40 bg-amber-500/10">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed">{dia.aviso}</p>
        </Tarjeta>
      )}

      {/* ------------------------------------------------------------ descanso */}
      {(!dia || dia.tipo === 'descanso') && (
        <Tarjeta className="py-10 text-center">
          <Icono className="mx-auto mb-3 text-[var(--color-suave)]" size={36} />
          <p className="text-lg font-bold">Hoy toca descansar</p>
          <p className="mt-1 text-sm text-[var(--color-suave)]">
            Descanso total. El plan sirve a la temporada, no al revés.
          </p>
        </Tarjeta>
      )}

      {/* --------------------------------------------------------- la sesión */}
      {/* No se mira el tipo para decidir qué pintar: se mira lo que la sesión
          tiene de verdad. Un plan importado puede etiquetar como "cardio" un
          día que además lleva ejercicios de sala, y aun así deben salir. */}
      {dia && dia.tipo !== 'descanso' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {prescripcion && (
              <Tarjeta
                className={
                  tieneEjercicios
                    ? 'bg-[var(--color-acento)]/10'
                    : 'bg-[var(--color-acento)]/10 sm:col-span-2'
                }
              >
                <p className="text-xs font-bold text-[var(--color-suave)] uppercase">
                  {dia.enfoque || 'Esta semana'}
                </p>
                <p
                  className={
                    tieneEjercicios
                      ? 'mt-1 font-semibold'
                      : 'mt-2 text-2xl leading-tight font-bold'
                  }
                >
                  {prescripcion}
                </p>
              </Tarjeta>
            )}

            {dia.calentamiento && (
              <Tarjeta>
                <p className="text-xs font-bold text-[var(--color-suave)] uppercase">
                  Calentamiento
                </p>
                <p className="mt-1 font-semibold">{dia.calentamiento}</p>
              </Tarjeta>
            )}
          </div>

          {intervalo && (
            <Boton className="w-full" onClick={() => setIntervalosAbiertos(true)}>
              <Timer size={20} />
              Temporizador de intervalos
            </Boton>
          )}

          {/* En PC caben dos ejercicios por fila sin apretar las fotos */}
          {tieneEjercicios && (
            <div className="grid gap-4 lg:grid-cols-2">
              {sesion &&
                dia.ejercicios.map((e) => (
                  <TarjetaEjercicio
                    key={e.slug}
                    ejercicio={e}
                    catalogoId={catalogoDe(e.slug, e.catalogo_id)}
                    prescripcion={prescripcionDe(
                      dia,
                      posicion.semana,
                      e.prescripcion,
                    )}
                    sesionId={sesion.id}
                    onSerieMarcada={() => setArrancarDescanso(Date.now())}
                    onMediaCambiada={() => void cargarMedias()}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------- cerrar sesión */}
      {sesion && dia && dia.tipo !== 'descanso' && (
        <div className="mt-6">
          {sesion.estado === 'hecha' ? (
            <Tarjeta className="text-center">
              <Etiqueta tono="ok">Sesión completada</Etiqueta>
              {sesion.duracion_min && (
                <p className="mt-2 text-sm text-[var(--color-suave)]">
                  {sesion.duracion_min} minutos
                </p>
              )}
              {sesion.notas && (
                <p className="mt-1 text-sm italic">«{sesion.notas}»</p>
              )}
              <Boton
                variante="fantasma"
                className="mt-2"
                onClick={() => setCerrando(true)}
              >
                Editar
              </Boton>
            </Tarjeta>
          ) : cerrando ? (
            <Tarjeta className="space-y-3">
              <div>
                <label
                  htmlFor="duracion"
                  className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
                >
                  Duración (minutos)
                </label>
                <Campo
                  id="duracion"
                  type="number"
                  inputMode="numeric"
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  placeholder="60"
                />
              </div>
              <div>
                <label
                  htmlFor="notas"
                  className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
                >
                  Nota (opcional)
                </label>
                <AreaTexto
                  id="notas"
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Cómo ha ido, molestias, sensaciones…"
                />
              </div>
              <div className="flex gap-2">
                <Boton className="flex-1" onClick={() => void terminarSesion()}>
                  Guardar
                </Boton>
                <Boton variante="fantasma" onClick={() => setCerrando(false)}>
                  Cancelar
                </Boton>
              </div>
            </Tarjeta>
          ) : (
            <Boton className="w-full" onClick={() => setCerrando(true)}>
              <Flag size={20} />
              Terminar sesión
            </Boton>
          )}
        </div>
      )}

      <button
        onClick={() => navegar('/semana')}
        className="mt-6 w-full text-center text-sm text-[var(--color-suave)] underline"
      >
        ¿Hoy entrenas otro día?
      </button>

      <TemporizadorDescanso
        segundos={ajustes.descanso_seg}
        onCambiarSegundos={(s) => cambiarAjustes({ descanso_seg: s })}
        arrancarEn={arrancarDescanso}
        onCerrar={() => setArrancarDescanso(null)}
      />

      {intervalosAbiertos && intervalo && (
        <TemporizadorIntervalos
          intervalo={intervalo}
          onCerrar={() => setIntervalosAbiertos(false)}
        />
      )}
    </>
  )
}
