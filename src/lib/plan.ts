import { differenceInCalendarDays, parseISO, addDays, format } from 'date-fns'
import {
  DIAS_KEYS,
  type Dia,
  type DiaKey,
  type Medicion,
  type Plan,
} from './tipos'

/** Convierte un Date a la clave de día que usa el plan. */
export function diaKeyDe(fecha: Date): DiaKey {
  // getDay(): 0 = domingo … 6 = sábado. Nuestro array empieza en lunes.
  const i = (fecha.getDay() + 6) % 7
  return DIAS_KEYS[i]
}

export function aISO(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd')
}

export interface PosicionBloque {
  /** true si la fecha es anterior al arranque del plan */
  antesDeEmpezar: boolean
  /** semana del bloque, 1..plan.semanas */
  semana: number
  nombreSemana: string
  /** cuántos bloques completos han pasado (0 = primer bloque) */
  bloque: number
  /** true cuando ya se han consumido todos los bloques previstos */
  bloqueTerminado: boolean
  diaKey: DiaKey
  dia: Dia | null
}

/**
 * Dónde cae una fecha dentro del plan: qué semana del bloque y qué sesión toca.
 * El bloque se repite indefinidamente; `bloqueTerminado` avisa cuando se ha
 * completado la primera vuelta para poder proponer un bloque nuevo.
 */
export function posicionEnPlan(plan: Plan, fecha: Date): PosicionBloque {
  const inicio = parseISO(plan.fecha_inicio)
  const dias = differenceInCalendarDays(fecha, inicio)
  const diaKey = diaKeyDe(fecha)
  const dia = plan.estructura.dias.find((d) => d.key === diaKey) ?? null

  if (dias < 0) {
    return {
      antesDeEmpezar: true,
      semana: 1,
      nombreSemana: plan.estructura.nombres_semana[0] ?? 'Semana 1',
      bloque: 0,
      bloqueTerminado: false,
      diaKey,
      dia,
    }
  }

  const semanaAbsoluta = Math.floor(dias / 7)
  const semana = (semanaAbsoluta % plan.semanas) + 1
  const bloque = Math.floor(semanaAbsoluta / plan.semanas)

  return {
    antesDeEmpezar: false,
    semana,
    nombreSemana:
      plan.estructura.nombres_semana[semana - 1] ?? `Semana ${semana}`,
    bloque,
    bloqueTerminado: bloque >= 1,
    diaKey,
    dia,
  }
}

/** Primer día (lunes) de la semana del bloque en la que cae `fecha`. */
export function lunesDeLaSemana(plan: Plan, fecha: Date): Date {
  const inicio = parseISO(plan.fecha_inicio)
  const dias = Math.max(0, differenceInCalendarDays(fecha, inicio))
  return addDays(inicio, Math.floor(dias / 7) * 7)
}

/** Las 7 fechas de la semana del bloque en la que cae `fecha`. */
export function fechasDeLaSemana(plan: Plan, fecha: Date): Date[] {
  const lunes = lunesDeLaSemana(plan, fecha)
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i))
}

/**
 * La prescripción que toca para esa semana: la del ejercicio si la tiene, y si
 * no, la de la sesión entera.
 */
export function prescripcionDe(
  dia: Dia,
  semana: number,
  propia?: Record<string, string>,
): string {
  const clave = String(semana)
  return propia?.[clave] ?? dia.prescripcion?.[clave] ?? ''
}

export function intervaloDe(dia: Dia, semana: number) {
  return dia.intervalos?.[String(semana)] ?? null
}

/**
 * Saca cuántas series y cuántas repeticiones pintar a partir del texto de la
 * prescripción ("3×10–12", "4 series en presses, 8–10 reps", "3×30 s por lado").
 * Es una ayuda para prerrellenar, no una verdad: siempre se puede editar.
 */
export function seriesYRepsDe(texto: string): {
  series: number
  reps: number | null
  /** segundos por serie, si la prescripción los indica ("3×30 s por lado") */
  segundos: number | null
} {
  if (!texto) return { series: 3, reps: null, segundos: null }

  // "3×30 s", "3x30 seg", "3 × 45 segundos"
  const porTiempo = texto.match(
    /(\d+)\s*[×xX]\s*(\d+)\s*(?:s\b|seg\b|segundos?\b)/i,
  )
  if (porTiempo) {
    return {
      series: Number(porTiempo[1]),
      reps: null,
      segundos: Number(porTiempo[2]),
    }
  }

  // "3×10", "4x8"
  const porEquis = texto.match(/(\d+)\s*[×xX]\s*(\d+)/)
  if (porEquis) {
    return {
      series: Number(porEquis[1]),
      reps: Number(porEquis[2]),
      segundos: null,
    }
  }

  // Minutos sueltos: "20 min suave" → una sola serie de esa duración
  const porMinutos = texto.match(/(\d+)\s*min\b/i)
  if (porMinutos && !/\d+\s*[×xX]/.test(texto)) {
    return { series: 1, reps: null, segundos: Number(porMinutos[1]) * 60 }
  }

  const porPalabra = texto.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*series/i)
  const reps = texto.match(/(\d+)(?:\s*[–-]\s*\d+)?\s*reps/i)
  if (porPalabra) {
    return {
      series: Number(porPalabra[1]),
      reps: reps ? Number(reps[1]) : null,
      segundos: null,
    }
  }

  return {
    series: 3,
    reps: reps ? Number(reps[1]) : null,
    segundos: null,
  }
}

/**
 * Cómo medir un ejercicio: lo que diga el plan y, si no lo dice, lo que se
 * deduzca de su prescripción (si habla de segundos, es de aguantar).
 */
export function medicionDe(
  ejercicio: { medicion?: Medicion },
  prescripcion: string,
): Medicion {
  if (ejercicio.medicion) return ejercicio.medicion
  return seriesYRepsDe(prescripcion).segundos !== null ? 'tiempo' : 'reps_peso'
}

/** Slug estable a partir del nombre, para enlazar el histórico entre planes. */
export function slugificar(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
