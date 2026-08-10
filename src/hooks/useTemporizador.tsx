import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { pararAlarma, sonarAlarma } from '@/lib/alarma'

/**
 * Un único temporizador para toda la app. Vive por encima del router, así que
 * sigue corriendo aunque se cambie de pestaña, y se guarda como *hora de fin*
 * (no como segundos que van bajando): si el móvil bloquea la pantalla o la app
 * se recarga, al volver el tiempo que muestra sigue siendo el de verdad.
 */

export type ModoTemporizador = 'descanso' | 'serie'

/** A qué serie pertenece una cuenta atrás de trabajo, para poder marcarla. */
export interface TareaSerie {
  sesionId: string
  slug: string
  serie: number
}

interface Estado {
  modo: ModoTemporizador
  etiqueta: string
  /** duración pedida, en segundos (0 en el cronómetro que sube) */
  duracion: number
  /** cuenta atrás; si es false, es un cronómetro que sube */
  cuentaAtras: boolean
  /** hora de fin (cuenta atrás) o de inicio (cronómetro), en ms */
  referencia: number
  /** segundos que quedaban al pausar; null si está corriendo */
  pausadoEn: number | null
  tarea: TareaSerie | null
  terminado: boolean
  /** true solo cuando terminó solo: parando a mano no hay que dar la alarma */
  avisar: boolean
}

interface IniciarOpciones {
  modo: ModoTemporizador
  segundos?: number
  etiqueta?: string
  tarea?: TareaSerie | null
}

interface Contexto {
  activo: boolean
  modo: ModoTemporizador
  etiqueta: string
  duracion: number
  cuentaAtras: boolean
  pausado: boolean
  terminado: boolean
  tarea: TareaSerie | null
  /** segundos que faltan (cuenta atrás) */
  restante: number
  /** segundos transcurridos (cronómetro) */
  transcurrido: number
  iniciar: (op: IniciarOpciones) => void
  fijarDuracion: (segundos: number) => void
  sumar: (segundos: number) => void
  reiniciar: () => void
  alternarPausa: () => void
  /** cierra el cronómetro dándolo por bueno, sin alarma */
  finalizar: () => void
  cerrar: () => void
  /** devuelve la tarea terminada una sola vez, para marcar la serie */
  consumirTarea: () => TareaSerie | null
}

const CLAVE = 'ea:temporizador'

const TemporizadorCtx = createContext<Contexto | null>(null)

function leerGuardado(): Estado | null {
  try {
    const bruto = localStorage.getItem(CLAVE)
    if (!bruto) return null
    const e = JSON.parse(bruto) as Estado
    if (typeof e?.referencia !== 'number') return null
    // Un temporizador de hace horas no interesa: se descarta en silencio.
    const antiguedad = Date.now() - e.referencia
    if (antiguedad > 2 * 60 * 60 * 1000) return null
    return e
  } catch {
    return null
  }
}

function guardar(estado: Estado | null) {
  try {
    if (estado) localStorage.setItem(CLAVE, JSON.stringify(estado))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* almacenamiento bloqueado */
  }
}

function segundosRestantes(e: Estado): number {
  if (!e.cuentaAtras) return 0
  if (e.pausadoEn !== null) return e.pausadoEn
  return Math.max(0, (e.referencia - Date.now()) / 1000)
}

function segundosTranscurridos(e: Estado): number {
  if (e.cuentaAtras) return Math.max(0, e.duracion - segundosRestantes(e))
  if (e.pausadoEn !== null) return e.pausadoEn
  return Math.max(0, (Date.now() - e.referencia) / 1000)
}

export function ProveedorTemporizador({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado | null>(leerGuardado)
  // Fuerza el recálculo en cada tick sin tocar el estado guardado
  const [latido, setLatido] = useState(0)
  const avisadoRef = useRef(false)

  useEffect(() => {
    guardar(estado)
  }, [estado])

  // Si al arrancar la app había una cuenta atrás ya vencida, se recupera
  // terminada en vez de perderse.
  useEffect(() => {
    if (estado?.cuentaAtras && !estado.terminado && segundosRestantes(estado) <= 0) {
      setEstado((e) => (e ? { ...e, terminado: true, avisar: true } : e))
    }
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!estado || estado.pausadoEn !== null || estado.terminado) return
    const tick = () => {
      setLatido((n) => n + 1)
      if (estado.cuentaAtras && segundosRestantes(estado) <= 0) {
        setEstado((e) => (e ? { ...e, terminado: true, avisar: true } : e))
      }
    }
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [estado])

  // La alarma suena una vez por cuenta atrás, no en cada repintado
  const debeAvisar = Boolean(estado?.terminado && estado.avisar)
  useEffect(() => {
    if (debeAvisar && !avisadoRef.current) {
      avisadoRef.current = true
      sonarAlarma()
    }
    if (!debeAvisar) avisadoRef.current = false
  }, [debeAvisar])

  const iniciar = useCallback((op: IniciarOpciones) => {
    pararAlarma()
    const cuentaAtras = (op.segundos ?? 0) > 0
    setEstado({
      modo: op.modo,
      etiqueta: op.etiqueta ?? '',
      duracion: op.segundos ?? 0,
      cuentaAtras,
      referencia: cuentaAtras
        ? Date.now() + (op.segundos ?? 0) * 1000
        : Date.now(),
      pausadoEn: null,
      tarea: op.tarea ?? null,
      terminado: false,
      avisar: false,
    })
  }, [])

  const fijarDuracion = useCallback((segundos: number) => {
    pararAlarma()
    setEstado((e) =>
      e
        ? {
            ...e,
            duracion: segundos,
            cuentaAtras: true,
            referencia: Date.now() + segundos * 1000,
            pausadoEn: null,
            terminado: false,
            avisar: false,
          }
        : e,
    )
  }, [])

  const sumar = useCallback((segundos: number) => {
    pararAlarma()
    setEstado((e) => {
      if (!e || !e.cuentaAtras) return e
      const quedan = Math.max(0, segundosRestantes(e) + segundos)
      return {
        ...e,
        duracion: Math.max(e.duracion + segundos, quedan),
        referencia: Date.now() + quedan * 1000,
        pausadoEn: e.pausadoEn === null ? null : quedan,
        terminado: quedan <= 0,
        avisar: quedan <= 0,
      }
    })
  }, [])

  const reiniciar = useCallback(() => {
    pararAlarma()
    setEstado((e) =>
      e
        ? {
            ...e,
            referencia: e.cuentaAtras
              ? Date.now() + e.duracion * 1000
              : Date.now(),
            pausadoEn: null,
            terminado: false,
            avisar: false,
          }
        : e,
    )
  }, [])

  const alternarPausa = useCallback(() => {
    setEstado((e) => {
      if (!e || e.terminado) return e
      if (e.pausadoEn !== null) {
        return {
          ...e,
          referencia: e.cuentaAtras
            ? Date.now() + e.pausadoEn * 1000
            : Date.now() - e.pausadoEn * 1000,
          pausadoEn: null,
        }
      }
      return {
        ...e,
        pausadoEn: e.cuentaAtras
          ? segundosRestantes(e)
          : segundosTranscurridos(e),
      }
    })
  }, [])

  const finalizar = useCallback(() => {
    pararAlarma()
    setEstado((e) =>
      e
        ? {
            ...e,
            // congelado: `pausadoEn` guarda lo que queda en la cuenta atrás y
            // lo contado en el cronómetro
            pausadoEn: e.cuentaAtras
              ? segundosRestantes(e)
              : segundosTranscurridos(e),
            terminado: true,
            avisar: false,
          }
        : e,
    )
  }, [])

  const cerrar = useCallback(() => {
    pararAlarma()
    setEstado(null)
  }, [])

  const consumirTarea = useCallback(() => {
    const tarea = estado?.tarea ?? null
    if (tarea) setEstado((e) => (e ? { ...e, tarea: null } : e))
    return tarea
  }, [estado])

  const valor = useMemo<Contexto>(
    () => ({
      activo: estado !== null,
      modo: estado?.modo ?? 'descanso',
      etiqueta: estado?.etiqueta ?? '',
      duracion: estado?.duracion ?? 0,
      cuentaAtras: estado?.cuentaAtras ?? true,
      pausado: estado?.pausadoEn !== null && estado !== null,
      terminado: estado?.terminado ?? false,
      tarea: estado?.tarea ?? null,
      restante: estado ? segundosRestantes(estado) : 0,
      transcurrido: estado ? segundosTranscurridos(estado) : 0,
      iniciar,
      fijarDuracion,
      sumar,
      reiniciar,
      alternarPausa,
      finalizar,
      cerrar,
      consumirTarea,
    }),
    [
      estado,
      // sin el latido, los segundos que ve la pantalla se quedarían congelados
      latido,
      iniciar,
      fijarDuracion,
      sumar,
      reiniciar,
      alternarPausa,
      finalizar,
      cerrar,
      consumirTarea,
    ],
  )

  return (
    <TemporizadorCtx.Provider value={valor}>{children}</TemporizadorCtx.Provider>
  )
}

export function useTemporizador(): Contexto {
  const ctx = useContext(TemporizadorCtx)
  if (!ctx) {
    throw new Error('useTemporizador necesita estar dentro de ProveedorTemporizador')
  }
  return ctx
}
