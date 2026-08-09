import { local, encolar } from './db'
import { supabase, hayNube } from './supabase'
import { crearPlanSemilla } from './seed'
import type {
  DiaKey,
  MediaEjercicio,
  Plan,
  Serie,
  Sesion,
  EstadoSesion,
} from './tipos'

/**
 * IndexedDB es siempre la fuente de lectura: así la app funciona sin cobertura.
 * Cuando hay Supabase configurado, cada escritura se replica en la nube y, si
 * falla, se deja en la cola de pendientes para reintentarla al recuperar la
 * conexión.
 */
/**
 * Cada tabla tiene, además del id, una clave natural que no se puede repetir
 * (una sesión por día y plan, una serie por ejercicio y número…). Si dos
 * dispositivos crean la misma fila por su cuenta, los ids son distintos pero la
 * clave natural choca. Diciéndole a Supabase cuál es esa clave, la segunda
 * escritura actualiza la fila en vez de fallar con un 409.
 */
export const CLAVE_NATURAL: Record<string, string> = {
  planes: 'id',
  sesiones: 'user_id,plan_id,fecha',
  series: 'sesion_id,ejercicio_slug,serie',
  media_ejercicios: 'user_id,ejercicio_slug',
  ajustes: 'user_id',
}

async function replicar(
  tabla: 'planes' | 'sesiones' | 'series' | 'media_ejercicios',
  fila: Record<string, unknown>,
) {
  if (!hayNube || !supabase) return
  try {
    const { data: sesionAuth } = await supabase.auth.getSession()
    const userId = sesionAuth.session?.user.id
    if (!userId) return
    const { error } = await supabase
      .from(tabla)
      .upsert({ ...fila, user_id: userId }, { onConflict: CLAVE_NATURAL[tabla] })
    if (error) throw error
  } catch {
    await encolar(tabla, 'upsert', fila)
  }
}

async function replicarBorrado(
  tabla: 'planes' | 'sesiones' | 'series' | 'media_ejercicios',
  id: string,
) {
  if (!hayNube || !supabase) return
  try {
    const { error } = await supabase.from(tabla).delete().eq('id', id)
    if (error) throw error
  } catch {
    await encolar(tabla, 'delete', { id })
  }
}

/* ---------------------------------------------------------------- planes -- */

export async function listarPlanes(): Promise<Plan[]> {
  const planes = await local.planes.toArray()
  return planes.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/**
 * Varias pantallas piden el plan a la vez (y en desarrollo React monta los
 * efectos dos veces), así que la llamada se comparte: sin esto la semilla se
 * crearía por duplicado.
 */
let resolviendoPlan: Promise<Plan | null> | null = null

export function planActivo(): Promise<Plan | null> {
  if (!resolviendoPlan) {
    resolviendoPlan = (async () => {
      const planes = await listarPlanes()
      const activo = planes.find((p) => p.activo)
      if (activo) return activo
      if (planes.length > 0) return planes[0]

      // Sin cuenta la app es de usar y tirar, así que se deja cargado el plan
      // de ejemplo para que sirva desde el minuto uno. Con cuenta no: cada
      // usuario empieza vacío y decide qué plan quiere.
      if (hayNube) return null

      const semilla = crearPlanSemilla()
      await guardarPlan(semilla)
      return semilla
    })().finally(() => {
      resolviendoPlan = null
    })
  }
  return resolviendoPlan
}

/** Carga el plan de ejemplo a petición del usuario. */
export async function cargarPlanDeEjemplo(): Promise<Plan> {
  const semilla = crearPlanSemilla()
  await guardarPlan(semilla)
  await activarPlan(semilla.id)
  return semilla
}

export async function guardarPlan(plan: Plan): Promise<void> {
  await local.planes.put(plan)
  await replicar('planes', plan as unknown as Record<string, unknown>)
}

export async function activarPlan(id: string): Promise<void> {
  const planes = await local.planes.toArray()
  await Promise.all(
    planes.map((p) => guardarPlan({ ...p, activo: p.id === id })),
  )
}

export async function borrarPlan(id: string): Promise<void> {
  const sesiones = await local.sesiones.where('plan_id').equals(id).toArray()
  for (const s of sesiones) await borrarSesion(s.id)
  await local.planes.delete(id)
  await replicarBorrado('planes', id)
}

/* -------------------------------------------------------------- sesiones -- */

export async function sesionDe(
  planId: string,
  fechaISO: string,
): Promise<Sesion | null> {
  const filas = await local.sesiones
    .where('[plan_id+fecha]')
    .equals([planId, fechaISO])
    .toArray()
  return filas[0] ?? null
}

export async function listarSesiones(planId?: string): Promise<Sesion[]> {
  const filas = planId
    ? await local.sesiones.where('plan_id').equals(planId).toArray()
    : await local.sesiones.toArray()
  return filas.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

/**
 * El identificador de una sesión se deriva del plan y la fecha, no es aleatorio.
 * Así el móvil y el ordenador generan el MISMO id para la sesión del mismo día,
 * y las series que cuelgan de ella siguen encajando cuando se sincroniza. Con
 * ids aleatorios cada dispositivo creaba el suyo y las series acababan
 * apuntando a una sesión que en la nube no existía.
 */
export async function idDeSesion(
  planId: string,
  fechaISO: string,
): Promise<string> {
  const datos = new TextEncoder().encode(`sesion:${planId}:${fechaISO}`)
  const resumen = new Uint8Array(await crypto.subtle.digest('SHA-256', datos))
  // Se le da forma de UUID v5 para que Postgres lo acepte como uuid
  resumen[6] = (resumen[6] & 0x0f) | 0x50
  resumen[8] = (resumen[8] & 0x3f) | 0x80
  const hex = [...resumen.slice(0, 16)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export async function abrirSesion(
  planId: string,
  fechaISO: string,
  diaKey: DiaKey,
  semana: number,
): Promise<Sesion> {
  const existente = await sesionDe(planId, fechaISO)
  if (existente) return existente
  const nueva: Sesion = {
    id: await idDeSesion(planId, fechaISO),
    plan_id: planId,
    fecha: fechaISO,
    dia_key: diaKey,
    semana,
    estado: 'parcial',
    duracion_min: null,
    notas: null,
    created_at: new Date().toISOString(),
  }
  await guardarSesion(nueva)
  return nueva
}

export async function guardarSesion(sesion: Sesion): Promise<void> {
  await local.sesiones.put(sesion)
  await replicar('sesiones', sesion as unknown as Record<string, unknown>)
}

export async function cerrarSesion(
  sesion: Sesion,
  estado: EstadoSesion,
  duracionMin: number | null,
  notas: string | null,
): Promise<void> {
  await guardarSesion({ ...sesion, estado, duracion_min: duracionMin, notas })
}

export async function borrarSesion(id: string): Promise<void> {
  const series = await local.series.where('sesion_id').equals(id).toArray()
  for (const s of series) {
    await local.series.delete(s.id)
    await replicarBorrado('series', s.id)
  }
  await local.sesiones.delete(id)
  await replicarBorrado('sesiones', id)
}

/* ---------------------------------------------------------------- series -- */

export async function seriesDe(sesionId: string): Promise<Serie[]> {
  const filas = await local.series.where('sesion_id').equals(sesionId).toArray()
  return filas.sort(
    (a, b) =>
      a.ejercicio_slug.localeCompare(b.ejercicio_slug) || a.serie - b.serie,
  )
}

export async function guardarSerie(serie: Serie): Promise<void> {
  await local.series.put(serie)
  await replicar('series', serie as unknown as Record<string, unknown>)
}

export interface RegistroPasado {
  fecha: string
  series: Serie[]
}

/** Últimas sesiones en las que se registró ese ejercicio, de más nueva a más vieja. */
export async function historico(
  ejercicioSlug: string,
  limite = 10,
): Promise<RegistroPasado[]> {
  const series = await local.series
    .where('ejercicio_slug')
    .equals(ejercicioSlug)
    .toArray()
  const hechas = series.filter((s) => s.hecha && (s.reps ?? 0) > 0)
  if (hechas.length === 0) return []

  const sesiones = await local.sesiones.toArray()
  const fechaPorSesion = new Map(sesiones.map((s) => [s.id, s.fecha]))

  const porSesion = new Map<string, Serie[]>()
  for (const s of hechas) {
    if (!fechaPorSesion.has(s.sesion_id)) continue
    const lista = porSesion.get(s.sesion_id) ?? []
    lista.push(s)
    porSesion.set(s.sesion_id, lista)
  }

  return [...porSesion.entries()]
    .map(([sesionId, lista]) => ({
      fecha: fechaPorSesion.get(sesionId)!,
      series: lista.sort((a, b) => a.serie - b.serie),
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, limite)
}

/** La última vez que hiciste ese ejercicio, excluyendo la sesión en curso. */
export async function ultimaVez(
  ejercicioSlug: string,
  excluirSesionId?: string,
): Promise<RegistroPasado | null> {
  const todos = await historico(ejercicioSlug, 20)
  const series = await local.series
    .where('ejercicio_slug')
    .equals(ejercicioSlug)
    .toArray()
  const sesionesExcluidas = new Set(
    excluirSesionId ? [excluirSesionId] : [],
  )
  const idsValidos = new Set(
    series
      .filter((s) => !sesionesExcluidas.has(s.sesion_id))
      .map((s) => s.sesion_id),
  )
  const sesiones = await local.sesiones.toArray()
  const fechasValidas = new Set(
    sesiones.filter((s) => idsValidos.has(s.id)).map((s) => s.fecha),
  )
  return todos.find((r) => fechasValidas.has(r.fecha)) ?? null
}

/** Resume un registro pasado en una línea legible: "3×10 con 12 kg". */
export function resumirRegistro(reg: RegistroPasado): string {
  const series = reg.series
  if (series.length === 0) return ''
  const reps = [...new Set(series.map((s) => s.reps).filter(Boolean))]
  const pesos = [...new Set(series.map((s) => s.peso_kg).filter(Boolean))]
  const parteReps =
    reps.length === 1 ? `${series.length}×${reps[0]}` : `${series.length} series`
  if (pesos.length === 0) return parteReps
  const parsePeso =
    pesos.length === 1
      ? `${pesos[0]} kg`
      : `${Math.min(...(pesos as number[]))}–${Math.max(...(pesos as number[]))} kg`
  return `${parteReps} con ${parsePeso}`
}

/* ------------------------------------------------------------- media ------ */

export async function mediaDe(slug: string): Promise<MediaEjercicio | null> {
  return (await local.media.get(slug)) ?? null
}

export async function todasLasMedias(): Promise<MediaEjercicio[]> {
  return local.media.toArray()
}

export async function guardarMedia(media: MediaEjercicio): Promise<void> {
  await local.media.put(media)
  await replicar(
    'media_ejercicios',
    media as unknown as Record<string, unknown>,
  )
}

/* ------------------------------------------------------- exportar/importar - */

export async function exportarTodo() {
  return {
    version: 1,
    exportado: new Date().toISOString(),
    planes: await local.planes.toArray(),
    sesiones: await local.sesiones.toArray(),
    series: await local.series.toArray(),
    media: await local.media.toArray(),
  }
}

export async function importarTodo(datos: Awaited<ReturnType<typeof exportarTodo>>) {
  await local.transaction(
    'rw',
    [local.planes, local.sesiones, local.series, local.media],
    async () => {
      await local.planes.bulkPut(datos.planes ?? [])
      await local.sesiones.bulkPut(datos.sesiones ?? [])
      await local.series.bulkPut(datos.series ?? [])
      await local.media.bulkPut(datos.media ?? [])
    },
  )
}
