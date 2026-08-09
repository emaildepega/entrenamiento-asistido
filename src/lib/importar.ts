import { supabase } from './supabase'
import { slugificar } from './plan'
import type { Dia, Ejercicio, Estructura, Intervalo } from './tipos'

/* Lo que devuelve la función: igual que Estructura pero con listas en vez de
   mapas, porque la salida estructurada no admite claves libres. */
interface EntradaSemana {
  semana: number
  texto: string
}

interface IntervaloCrudo extends Intervalo {
  semana: number
}

interface EjercicioCrudo extends Omit<Ejercicio, 'slug' | 'prescripcion'> {
  prescripcion?: EntradaSemana[] | null
}

interface DiaCrudo
  extends Omit<Dia, 'ejercicios' | 'prescripcion' | 'intervalos'> {
  ejercicios?: EjercicioCrudo[]
  prescripcion?: EntradaSemana[]
  intervalos?: IntervaloCrudo[] | null
}

interface EstructuraCruda {
  nombre?: string
  descripcion?: string
  semanas?: number
  nombres_semana?: string[]
  avisos?: string[]
  dias: DiaCrudo[]
}

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

  const cruda = (data as { estructura?: EstructuraCruda })?.estructura
  if (!cruda || !Array.isArray(cruda.dias)) {
    throw new Error('La respuesta no tiene la forma esperada')
  }

  // La salida estructurada no admite mapas abiertos, así que todo lo que va
  // "por semana" llega como lista y se convierte aquí a la forma de la app.
  const aMapa = (lista?: EntradaSemana[] | null) => {
    if (!lista?.length) return undefined
    const mapa: Record<string, string> = {}
    for (const { semana, texto } of lista) mapa[String(semana)] = texto
    return mapa
  }

  const aMapaIntervalos = (lista?: IntervaloCrudo[] | null) => {
    if (!lista?.length) return undefined
    const mapa: Record<string, Intervalo> = {}
    for (const { semana, ...resto } of lista) mapa[String(semana)] = resto
    return mapa
  }

  const estructura: Estructura = {
    semanas: cruda.semanas ?? 1,
    nombres_semana: cruda.nombres_semana?.length
      ? cruda.nombres_semana
      : Array.from({ length: cruda.semanas ?? 1 }, (_, i) => `Semana ${i + 1}`),
    avisos: cruda.avisos ?? [],
    dias: cruda.dias.map((d) => ({
      ...d,
      prescripcion: aMapa(d.prescripcion) ?? {},
      intervalos: aMapaIntervalos(d.intervalos),
      // La IA no devuelve los slugs: se calculan aquí para que sean estables.
      ejercicios: (d.ejercicios ?? []).map((e) => ({
        ...e,
        slug: slugificar(e.nombre),
        prescripcion: aMapa(e.prescripcion),
      })),
    })),
  }

  const sinAnimacion = estructura.dias
    .filter((d) => d.tipo === 'gimnasio')
    .flatMap((d) => d.ejercicios)
    .filter((e) => !e.catalogo_id)
    .map((e) => e.nombre)

  return {
    nombre: cruda.nombre ?? 'Plan sin nombre',
    descripcion: cruda.descripcion ?? '',
    semanas: cruda.semanas ?? 1,
    estructura,
    sinAnimacion,
  }
}
