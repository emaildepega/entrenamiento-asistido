import { local } from './db'
import { supabase, hayNube } from './supabase'
import type { MediaEjercicio, Plan, Serie, Sesion } from './tipos'

/**
 * IndexedDB es siempre la fuente de lectura de la app. Este módulo la pone al
 * día con Supabase: baja lo que hay en la nube, sube lo que solo existe aquí y
 * vacía la cola de operaciones que quedaron pendientes sin conexión.
 */

export interface ResultadoSync {
  bajados: number
  subidos: number
  errores: number
}

async function usuarioActual(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export async function sincronizar(): Promise<ResultadoSync> {
  const resultado: ResultadoSync = { bajados: 0, subidos: 0, errores: 0 }
  if (!hayNube || !supabase) return resultado

  const userId = await usuarioActual()
  if (!userId) return resultado

  /* 1. Bajar lo que hay en la nube -------------------------------------- */
  const [planes, sesiones, series, medias] = await Promise.all([
    supabase.from('planes').select('*'),
    supabase.from('sesiones').select('*'),
    supabase.from('series').select('*'),
    supabase.from('media_ejercicios').select('*'),
  ])

  const sinUsuario = <T extends { user_id?: string }>(filas: T[] | null) =>
    (filas ?? []).map(({ user_id: _ignorado, ...resto }) => resto)

  if (planes.data) {
    await local.planes.bulkPut(sinUsuario(planes.data) as unknown as Plan[])
    resultado.bajados += planes.data.length
  }
  if (sesiones.data) {
    await local.sesiones.bulkPut(sinUsuario(sesiones.data) as unknown as Sesion[])
    resultado.bajados += sesiones.data.length
  }
  if (series.data) {
    await local.series.bulkPut(sinUsuario(series.data) as unknown as Serie[])
    resultado.bajados += series.data.length
  }
  if (medias.data) {
    await local.media.bulkPut(
      sinUsuario(medias.data).map((m) => {
        const { id: _id, ...resto } = m as Record<string, unknown>
        return resto as unknown as MediaEjercicio
      }),
    )
    resultado.bajados += medias.data.length
  }

  /* 2. Subir lo que solo existe en este dispositivo ---------------------- */
  const idsRemotos = {
    planes: new Set((planes.data ?? []).map((p) => p.id as string)),
    sesiones: new Set((sesiones.data ?? []).map((s) => s.id as string)),
    series: new Set((series.data ?? []).map((s) => s.id as string)),
    medias: new Set(
      (medias.data ?? []).map((m) => m.ejercicio_slug as string),
    ),
  }

  const subir = async (
    tabla: 'planes' | 'sesiones' | 'series' | 'media_ejercicios',
    filas: object[],
  ) => {
    if (filas.length === 0) return
    const { error } = await supabase!
      .from(tabla)
      .upsert(filas.map((f) => ({ ...f, user_id: userId })))
    if (error) resultado.errores += filas.length
    else resultado.subidos += filas.length
  }

  await subir(
    'planes',
    (await local.planes.toArray()).filter((p) => !idsRemotos.planes.has(p.id)),
  )
  await subir(
    'sesiones',
    (await local.sesiones.toArray()).filter(
      (s) => !idsRemotos.sesiones.has(s.id),
    ),
  )
  await subir(
    'series',
    (await local.series.toArray()).filter((s) => !idsRemotos.series.has(s.id)),
  )
  await subir(
    'media_ejercicios',
    (await local.media.toArray()).filter(
      (m) => !idsRemotos.medias.has(m.ejercicio_slug),
    ),
  )

  /* 3. Vaciar la cola de pendientes -------------------------------------- */
  const pendientes = (await local.pendientes.toArray()).sort((a, b) =>
    a.creada.localeCompare(b.creada),
  )
  for (const op of pendientes) {
    try {
      if (op.operacion === 'delete') {
        const { id } = op.datos as { id: string }
        const { error } = await supabase.from(op.tabla).delete().eq('id', id)
        if (error) throw error
      } else {
        const fila = op.datos as Record<string, unknown>
        const { error } = await supabase
          .from(op.tabla)
          .upsert({ ...fila, user_id: userId })
        if (error) throw error
      }
      await local.pendientes.delete(op.id)
      resultado.subidos++
    } catch {
      // Se queda en la cola para el próximo intento; no se pierde nada.
      resultado.errores++
    }
  }

  return resultado
}

/** Borra la copia local. Se usa al cerrar sesión para no dejar datos ajenos. */
export async function limpiarLocal() {
  await local.transaction(
    'rw',
    [local.planes, local.sesiones, local.series, local.media, local.pendientes],
    async () => {
      await local.planes.clear()
      await local.sesiones.clear()
      await local.series.clear()
      await local.media.clear()
      await local.pendientes.clear()
    },
  )
}

export async function pendientesCount(): Promise<number> {
  return local.pendientes.count()
}
