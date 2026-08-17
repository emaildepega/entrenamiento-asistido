import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { parseISO } from 'date-fns'
import {
  AlertTriangle,
  Bike,
  CalendarPlus,
  ClipboardList,
  Flag,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { TarjetaEjercicio } from '@/components/TarjetaEjercicio'
import { TemporizadorIntervalos } from '@/components/TemporizadorIntervalos'
import { AreaTexto, Boton, Campo, Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import { useAjustes } from '@/hooks/useAjustes'
import { useTemporizador } from '@/hooks/useTemporizador'
import { useWakeLock } from '@/hooks/useWakeLock'
import {
  abrirSesion,
  cerrarSesion,
  empezarEntrenamiento,
  guardarPlan,
  LIMITE_ENTRENO_MIN,
  minutosCronometrados,
  olvidarArranque,
  todasLasMedias,
} from '@/lib/datos'
import {
  aISO,
  intervaloDe,
  posicionEnPlan,
  prescripcionDe,
} from '@/lib/plan'
import { actividadesStrava, type ActividadStrava } from '@/lib/strava'
import { siguienteLunes } from '@/lib/seed'
import { iconoDeDia } from '@/lib/iconos'
import { cronometro, duracionLarga, fechaCorta, fechaLarga } from '@/lib/utils'
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
  const { ajustes } = useAjustes()
  const temporizador = useTemporizador()
  const [intervalosAbiertos, setIntervalosAbiertos] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [duracion, setDuracion] = useState('')
  const [notas, setNotas] = useState('')
  const [deStrava, setDeStrava] = useState<ActividadStrava | null>(null)

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

  // Lo que Strava haya registrado ese día: sirve para no tener que teclear la
  // duración de una salida que ya está medida.
  useEffect(() => {
    const iso = aISO(fecha)
    let vivo = true
    void actividadesStrava(iso).then((lista) => {
      if (!vivo) return
      const delDia = lista.filter((a) => a.fecha_local === iso)
      // la más larga del día, que es la que representa la sesión
      delDia.sort((a, b) => b.segundos_movimiento - a.segundos_movimiento)
      setDeStrava(delDia[0] ?? null)
    })
    return () => {
      vivo = false
    }
  }, [fecha])

  // Mientras el entreno corre, el reloj de pantalla se refresca cada segundo.
  // El tiempo NO se cuenta aquí: se calcula desde la hora guardada, así que
  // cambiar de pantalla, recargar o seguir en el ordenador da igual.
  const [, setLatido] = useState(0)
  const enMarcha = Boolean(sesion?.empezada_en) && sesion?.estado === 'parcial'
  useEffect(() => {
    if (!enMarcha) return
    const t = window.setInterval(() => setLatido((n) => n + 1), 1000)
    return () => window.clearInterval(t)
  }, [enMarcha])

  const segundosEntrenando = sesion?.empezada_en
    ? Math.max(0, (Date.now() - new Date(sesion.empezada_en).getTime()) / 1000)
    : 0
  const seQuedoAbierto =
    enMarcha && segundosEntrenando / 60 > LIMITE_ENTRENO_MIN

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

  const arrancarEntreno = async () => {
    if (!sesion) return
    setSesion(await empezarEntrenamiento(sesion))
  }

  const cancelarArranque = async () => {
    if (!sesion) return
    setSesion(await olvidarArranque(sesion))
  }

  /**
   * Al ir a cerrar se propone la duración en vez de preguntarla a secas: manda
   * el cronómetro y, si no se usó, lo que diga Strava de ese día.
   */
  const abrirCierre = () => {
    const cronometrados = minutosCronometrados(sesion)
    if (cronometrados !== null) setDuracion(String(cronometrados))
    else if (deStrava) {
      setDuracion(
        (actual) =>
          actual || String(Math.round(deStrava.segundos_movimiento / 60)),
      )
    }
    setCerrando(true)
  }

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

          {deStrava && (
            <Tarjeta className="flex items-start gap-3 border-[#fc4c02]/40 bg-[#fc4c02]/10">
              <Bike size={20} className="mt-0.5 shrink-0 text-[#fc4c02]" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--color-suave)] uppercase">
                  Hoy en Strava
                </p>
                <p className="truncate font-semibold">{deStrava.nombre}</p>
                <p className="mt-0.5 text-sm text-[var(--color-suave)]">
                  {duracionLarga(deStrava.segundos_movimiento)} ·{' '}
                  {(deStrava.metros / 1000).toFixed(1)} km
                  {deStrava.desnivel_m > 0 &&
                    ` · ${Math.round(deStrava.desnivel_m)} m`}
                  {deStrava.pulso_medio &&
                    ` · ${Math.round(deStrava.pulso_medio)} ppm`}
                </p>
              </div>
            </Tarjeta>
          )}

          {intervalo && (
            <Boton className="w-full" onClick={() => setIntervalosAbiertos(true)}>
              <Timer size={20} />
              Temporizador de intervalos
            </Boton>
          )}

          {/* ------------------------------------------ empezar / cronómetro */}
          {sesion && sesion.estado !== 'hecha' && (
            <>
              {!sesion.empezada_en && (
                <Boton
                  className="w-full"
                  onClick={() => void arrancarEntreno()}
                >
                  <Play size={20} />
                  Empezar entrenamiento
                </Boton>
              )}

              {enMarcha && !seQuedoAbierto && (
                <Tarjeta className="flex items-center gap-3 border-[var(--color-acento)]/40 bg-[var(--color-acento)]/10">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--color-acento)] opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-[var(--color-acento)]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--color-suave)] uppercase">
                      Entrenando
                    </p>
                    <p className="font-mono text-2xl leading-tight font-black tabular-nums">
                      {cronometro(segundosEntrenando)}
                    </p>
                  </div>
                  <button
                    onClick={() => void cancelarArranque()}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[var(--color-suave)] underline"
                  >
                    No he empezado aún
                  </button>
                </Tarjeta>
              )}

              {seQuedoAbierto && (
                <Tarjeta className="flex gap-3 border-amber-500/40 bg-amber-500/10">
                  <AlertTriangle
                    size={20}
                    className="mt-0.5 shrink-0 text-amber-400"
                  />
                  <div className="text-sm">
                    <p className="font-bold">El cronómetro se quedó abierto</p>
                    <p className="mt-1 text-[var(--color-suave)]">
                      Lleva contando desde hace más de {LIMITE_ENTRENO_MIN / 60}{' '}
                      horas, así que no vale como duración. Ponlo a cero y
                      empieza otra vez, o escribe los minutos al terminar.
                    </p>
                    <Boton
                      variante="fantasma"
                      className="mt-1 min-h-10 px-0"
                      onClick={() => void cancelarArranque()}
                    >
                      <RotateCcw size={16} />
                      Poner a cero
                    </Boton>
                  </div>
                </Tarjeta>
              )}
            </>
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
                    onSerieMarcada={() =>
                      temporizador.iniciar({
                        modo: 'descanso',
                        segundos: ajustes.descanso_seg,
                      })
                    }
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
                {minutosCronometrados(sesion) !== null ? (
                  <p className="mt-1 text-xs text-[var(--color-suave)]">
                    Cronometrado desde que empezaste. Puedes corregirlo.
                  </p>
                ) : (
                  deStrava && (
                    <p className="mt-1 text-xs text-[var(--color-suave)]">
                      Propuesto por Strava: «{deStrava.nombre}»
                    </p>
                  )
                )}
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
            <Boton className="w-full" onClick={abrirCierre}>
              <Flag size={20} />
              {enMarcha && !seQuedoAbierto
                ? `Terminar entrenamiento · ${cronometro(segundosEntrenando)}`
                : 'Terminar entrenamiento'}
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

      {intervalosAbiertos && intervalo && (
        <TemporizadorIntervalos
          intervalo={intervalo}
          onCerrar={() => setIntervalosAbiertos(false)}
        />
      )}
    </>
  )
}
