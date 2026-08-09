import { local } from './db'
import { CLAVE_NATURAL, idDeSesion } from './datos'
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
  /** el primer error de verdad, para poder enseñarlo en vez de adivinar */
  detalle: string | null
}

async function usuarioActual(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

const claveSesion = (s: { plan_id: string; fecha: string }) =>
  `${s.plan_id}|${s.fecha}`

/**
 * Antes las sesiones llevaban un id aleatorio, así que el móvil y el ordenador
 * creaban dos distintos para el mismo día y las series acababan apuntando a una
 * sesión que en la nube no existía. Aquí se unifican: manda el id de la nube y,
 * si no lo hay, el que sale de la fecha y el plan.
 */
async function reconciliarSesiones(remotas: Sesion[]): Promise<void> {
  const idRemotoPorClave = new Map(remotas.map((s) => [claveSesion(s), s.id]))
  const locales = await local.sesiones.toArray()

  for (const sesion of locales) {
    const idBueno =
      idRemotoPorClave.get(claveSesion(sesion)) ??
      (await idDeSesion(sesion.plan_id, sesion.fecha))

    if (idBueno === sesion.id) continue

    // Las series se quedarían huérfanas: se les cambia el padre antes de nada
    const series = await local.series
      .where('sesion_id')
      .equals(sesion.id)
      .toArray()
    for (const serie of series) {
      await local.series.delete(serie.id)
      await local.series.put({ ...serie, sesion_id: idBueno })
    }
    await local.sesiones.delete(sesion.id)
    await local.sesiones.put({ ...sesion, id: idBueno })
  }
}

/** Series que apuntan a una sesión que ya no existe: no se pueden subir nunca. */
async function limpiarSeriesHuerfanas(): Promise<number> {
  const idsSesion = new Set((await local.sesiones.toArray()).map((s) => s.id))
  const huerfanas = (await local.series.toArray()).filter(
    (s) => !idsSesion.has(s.sesion_id),
  )
  for (const s of huerfanas) await local.series.delete(s.id)
  return huerfanas.length
}

export async function sincronizar(): Promise<ResultadoSync> {
  const resultado: ResultadoSync = {
    bajados: 0,
    subidos: 0,
    errores: 0,
    detalle: null,
  }
  if (!hayNube || !supabase) return resultado

  const userId = await usuarioActual()
  if (!userId) return resultado

  const anotarError = (mensaje: string, cuantos: number) => {
    resultado.errores += cuantos
    if (!resultado.detalle) resultado.detalle = mensaje
  }

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

  const sesionesRemotas = sinUsuario(sesiones.data) as unknown as Sesion[]
  await reconciliarSesiones(sesionesRemotas)

  if (sesiones.data) {
    await local.sesiones.bulkPut(sesionesRemotas)
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

  await limpiarSeriesHuerfanas()

  /* 2. Subir lo que solo existe en este dispositivo ---------------------- */
  const subir = async (
    tabla: 'planes' | 'sesiones' | 'series' | 'media_ejercicios',
    filas: object[],
  ) => {
    if (filas.length === 0) return
    const { error } = await supabase!
      .from(tabla)
      .upsert(
        filas.map((f) => ({ ...f, user_id: userId })),
        { onConflict: CLAVE_NATURAL[tabla] },
      )
    if (error) anotarError(`${tabla}: ${error.message}`, filas.length)
    else resultado.subidos += filas.length
  }

  // El orden importa: una sesión necesita su plan, y una serie su sesión.
  await subir('planes', await local.planes.toArray())
  await subir('sesiones', await local.sesiones.toArray())
  await subir('series', await local.series.toArray())
  await subir('media_ejercicios', await local.media.toArray())

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
          .upsert(
            { ...fila, user_id: userId },
            { onConflict: CLAVE_NATURAL[op.tabla] },
          )
        if (error) throw error
      }
      await local.pendientes.delete(op.id)
      resultado.subidos++
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e)
      // Lo que ya se ha subido arriba, o apunta a algo que no existe, no va a
      // funcionar por reintentarlo: se saca de la cola para no dejar el aviso
      // colgado para siempre.
      if (/duplicate key|foreign key|violates/i.test(mensaje)) {
        await local.pendientes.delete(op.id)
      } else {
        anotarError(`${op.tabla}: ${mensaje}`, 1)
      }
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
