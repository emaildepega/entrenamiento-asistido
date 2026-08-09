import { supabase } from './supabase'
import { slugificar } from './plan'
import type { Estructura } from './tipos'

/** Convierte un File en base64 sin saltos de línea, que es lo que espera la API. */
export function aBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'))
    lector.onload = () => {
      const resultado = String(lector.result)
      resolve(resultado.slice(resultado.indexOf(',') + 1))
    }
    lector.readAsDataURL(archivo)
  })
}

export interface PlanLeido {
  nombre: string
  descripcion: string
  semanas: number
  estructura: Estructura
  /** ejercicios de sala que se han quedado sin animación */
  sinAnimacion: string[]
}

/**
 * Manda el PDF a la Edge Function, que se lo pasa a Claude. La clave de la API
 * vive solo en el servidor; el navegador nunca la ve.
 */
export async function leerPlanPdf(archivo: File): Promise<PlanLeido> {
  if (!supabase) {
    throw new Error('Necesitas tener la cuenta configurada para subir planes')
  }
  if (archivo.type !== 'application/pdf') {
    throw new Error('El archivo tiene que ser un PDF')
  }
  if (archivo.size > 10 * 1024 * 1024) {
    throw new Error('El PDF pesa más de 10 MB')
  }

  const { data, error } = await supabase.functions.invoke('parse-plan', {
    body: {
      pdf_base64: await aBase64(archivo),
      nombre_archivo: archivo.name,
    },
  })

  if (error) {
    // El cuerpo del error trae el mensaje en castellano de la función
    let detalle = ''
    const contexto = (error as { context?: Response }).context
    if (contexto && typeof contexto.json === 'function') {
      try {
        detalle = (await contexto.json())?.error ?? ''
      } catch {
        /* la respuesta no era JSON */
      }
    }
    throw new Error(detalle || 'No se ha podido leer el PDF')
  }

  const cruda = (data as { estructura?: Estructura })?.estructura
  if (!cruda || !Array.isArray(cruda.dias)) {
    throw new Error('La respuesta no tiene la forma esperada')
  }

  // La IA no devuelve los slugs: se calculan aquí para que sean estables.
  const estructura: Estructura = {
    ...cruda,
    nombres_semana: cruda.nombres_semana?.length
      ? cruda.nombres_semana
      : Array.from({ length: cruda.semanas }, (_, i) => `Semana ${i + 1}`),
    avisos: cruda.avisos ?? [],
    dias: cruda.dias.map((d) => ({
      ...d,
      ejercicios: (d.ejercicios ?? []).map((e) => ({
        ...e,
        slug: slugificar(e.nombre),
      })),
    })),
  }

  const sinAnimacion = estructura.dias
    .filter((d) => d.tipo === 'gimnasio')
    .flatMap((d) => d.ejercicios)
    .filter((e) => !e.catalogo_id)
    .map((e) => e.nombre)

  return {
    nombre: (cruda as unknown as { nombre?: string }).nombre ?? 'Plan sin nombre',
    descripcion:
      (cruda as unknown as { descripcion?: string }).descripcion ?? '',
    semanas: cruda.semanas ?? 1,
    estructura,
    sinAnimacion,
  }
}
