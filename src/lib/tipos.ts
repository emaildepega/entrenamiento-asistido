export type TipoDia = 'gimnasio' | 'cardio' | 'salida' | 'descanso'

export const DIAS_KEYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const

export type DiaKey = (typeof DIAS_KEYS)[number]

export const NOMBRES_DIA: Record<DiaKey, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
}

/**
 * Cómo se mide un ejercicio. No todos van de repetir un movimiento con peso:
 * una plancha se aguanta un tiempo, y un superman se cuenta por repeticiones
 * pero sin peso ninguno.
 */
export type Medicion = 'reps_peso' | 'reps' | 'tiempo'

export const MEDICIONES: { valor: Medicion; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'reps_peso',
    etiqueta: 'Repeticiones y peso',
    ayuda: 'Press de banca, remo, curl…',
  },
  {
    valor: 'reps',
    etiqueta: 'Solo repeticiones',
    ayuda: 'Peso corporal: crunch, superman…',
  },
  {
    valor: 'tiempo',
    etiqueta: 'Tiempo aguantado',
    ayuda: 'Planchas y otros isométricos',
  },
]

export interface Ejercicio {
  slug: string
  nombre: string
  /** id del catálogo de animaciones; null si aún no se ha asignado */
  catalogo_id: string | null
  youtube_id: string | null
  /** series/reps por semana del bloque ("1".."4"); si falta, usa la del día */
  prescripcion?: Record<string, string>
  /** cómo se registra; por defecto repeticiones y peso */
  medicion?: Medicion
  /** cuántas filas de series pintar; por defecto 3 */
  series_objetivo?: number
}

export interface Intervalo {
  series: number
  trabajo_min: number
  descanso_min: number
}

export interface Dia {
  key: DiaKey
  nombre: string
  tipo: TipoDia
  hora_inicio?: string
  hora_fin?: string
  enfoque?: string
  /** aviso destacado que sale arriba del todo ese día */
  aviso?: string
  calentamiento?: string
  ejercicios: Ejercicio[]
  /** prescripción de la sesión por semana del bloque */
  prescripcion: Record<string, string>
  /** configuración del temporizador de intervalos por semana */
  intervalos?: Record<string, Intervalo | null>
}

export interface Estructura {
  semanas: number
  nombres_semana: string[]
  dias: Dia[]
  avisos: string[]
}

export interface Plan {
  id: string
  nombre: string
  descripcion: string
  semanas: number
  /** ISO yyyy-mm-dd */
  fecha_inicio: string
  activo: boolean
  estructura: Estructura
  created_at: string
}

export type EstadoSesion = 'hecha' | 'saltada' | 'parcial'

export interface Sesion {
  id: string
  plan_id: string
  /** ISO yyyy-mm-dd */
  fecha: string
  dia_key: DiaKey
  semana: number
  estado: EstadoSesion
  /** cuándo se pulsó "Empezar entrenamiento"; null si no se cronometró */
  empezada_en: string | null
  duracion_min: number | null
  notas: string | null
  created_at: string
}

export interface Serie {
  id: string
  sesion_id: string
  ejercicio_slug: string
  ejercicio_nombre: string
  serie: number
  reps: number | null
  peso_kg: number | null
  /** segundos aguantados, en los ejercicios que se miden por tiempo */
  segundos: number | null
  hecha: boolean
}

export interface MediaEjercicio {
  ejercicio_slug: string
  catalogo_id: string | null
  youtube_id: string | null
}

export interface EntradaCatalogo {
  id: string
  n: string
  eq: string
  m: string
}
