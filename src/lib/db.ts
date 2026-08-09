import Dexie, { type EntityTable } from 'dexie'
import type { MediaEjercicio, Plan, Serie, Sesion } from './tipos'

/**
 * Almacén local (IndexedDB). Es la fuente de verdad cuando no hay Supabase
 * configurado, y la caché + cola de sincronización cuando sí lo hay.
 */
export interface OperacionPendiente {
  id: string
  tabla: 'planes' | 'sesiones' | 'series' | 'media_ejercicios'
  operacion: 'upsert' | 'delete'
  datos: unknown
  creada: string
}

class BaseLocal extends Dexie {
  planes!: EntityTable<Plan, 'id'>
  sesiones!: EntityTable<Sesion, 'id'>
  series!: EntityTable<Serie, 'id'>
  media!: EntityTable<MediaEjercicio, 'ejercicio_slug'>
  pendientes!: EntityTable<OperacionPendiente, 'id'>

  constructor() {
    super('entrenamiento')
    this.version(1).stores({
      planes: 'id, activo, created_at',
      sesiones: 'id, plan_id, fecha, dia_key, [plan_id+fecha]',
      series: 'id, sesion_id, ejercicio_slug, [sesion_id+ejercicio_slug]',
      media: 'ejercicio_slug',
      pendientes: 'id, creada',
    })
  }
}

export const local = new BaseLocal()

export async function encolar(
  tabla: OperacionPendiente['tabla'],
  operacion: OperacionPendiente['operacion'],
  datos: unknown,
) {
  await local.pendientes.put({
    id: crypto.randomUUID(),
    tabla,
    operacion,
    datos,
    creada: new Date().toISOString(),
  })
}
