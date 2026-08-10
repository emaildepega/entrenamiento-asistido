import { supabase } from './supabase'
import { local } from './db'
import { slugificar } from './plan'
import type { Ejercicio, Medicion } from './tipos'

export interface Encontrado {
  nombre: string
  catalogo_id: string | null
  youtube_id: string | null
  medicion?: Medicion
}

/**
 * Pide a la IA la animación y el vídeo de uno o varios ejercicios. Los dos
 * resultados vienen ya comprobados por el servidor: si algo no se pudo
 * verificar, vuelve como null en vez de dejar un enlace roto.
 */
export async function buscarEjercicios(
  nombres: string[],
): Promise<Encontrado[]> {
  if (!supabase) {
    throw new Error('Necesitas tener la cuenta configurada para esta búsqueda')
  }
  const limpios = nombres.map((n) => n.trim()).filter(Boolean)
  if (limpios.length === 0) return []

  const { data, error } = await supabase.functions.invoke('buscar-ejercicio', {
    body: { nombres: limpios },
  })

  if (error) {
    let detalle = ''
    const contexto = (error as { context?: Response }).context
    if (contexto && typeof contexto.json === 'function') {
      try {
        detalle = (await contexto.json())?.error ?? ''
      } catch {
        /* la respuesta no era JSON */
      }
    }
    throw new Error(detalle || 'No se ha podido buscar el ejercicio')
  }

  return (data as { resultados?: Encontrado[] })?.resultados ?? []
}

/** Todos los ejercicios que aparecen en algún plan guardado, sin repetir. */
export async function ejerciciosConocidos(): Promise<Ejercicio[]> {
  const planes = await local.planes.toArray()
  const porSlug = new Map<string, Ejercicio>()
  for (const p of planes) {
    for (const d of p.estructura.dias) {
      for (const e of d.ejercicios) {
        // Se queda el primero que tenga animación, que es el más completo
        const previo = porSlug.get(e.slug)
        if (!previo || (!previo.catalogo_id && e.catalogo_id)) {
          porSlug.set(e.slug, e)
        }
      }
    }
  }
  return [...porSlug.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function ejercicioNuevo(
  nombre: string,
  catalogoId: string | null = null,
  youtubeId: string | null = null,
  medicion?: Medicion,
): Ejercicio {
  return {
    slug: slugificar(nombre),
    nombre: nombre.trim(),
    catalogo_id: catalogoId,
    youtube_id: youtubeId,
    ...(medicion ? { medicion } : {}),
  }
}
