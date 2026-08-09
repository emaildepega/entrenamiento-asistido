// Convierte un plan de entrenamiento en PDF en la estructura que usa la app.
// El PDF se manda tal cual a Claude (no se extrae el texto en el navegador:
// los planes traen tablas de progresión y el texto plano las destroza).
//
// Desplegar:  supabase functions deploy parse-plan
// Secreto:    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

const ORIGEN_CATALOGO =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'

interface EntradaCatalogo {
  id: string
  n: string
  eq: string
  m: string
}

let catalogoCache: EntradaCatalogo[] | null = null

async function catalogo(): Promise<EntradaCatalogo[]> {
  if (catalogoCache) return catalogoCache
  const res = await fetch(ORIGEN_CATALOGO)
  if (!res.ok) throw new Error('No se pudo descargar el catálogo de ejercicios')
  const todos = await res.json()
  catalogoCache = todos
    .filter((e: { images?: string[] }) => (e.images?.length ?? 0) >= 2)
    .map((e: { id: string; name: string; equipment?: string; primaryMuscles?: string[] }) => ({
      id: e.id,
      n: e.name,
      eq: e.equipment ?? 'other',
      m: e.primaryMuscles?.[0] ?? 'other',
    }))
  return catalogoCache!
}

/* --------------------------------------------------------------- esquema -- */

const EJERCICIO = {
  type: 'object',
  properties: {
    nombre: { type: 'string', description: 'Nombre del ejercicio en castellano' },
    catalogo_id: {
      type: ['string', 'null'],
      description:
        'id del catálogo cuyo movimiento coincide de verdad, o null si ninguno corresponde',
    },
    youtube_id: { type: 'null' },
    prescripcion: {
      type: ['object', 'null'],
      description:
        'series y repeticiones por semana del bloque, con claves "1".."N". null si aplica la de la sesión',
      additionalProperties: { type: 'string' },
    },
  },
  required: ['nombre', 'catalogo_id', 'youtube_id', 'prescripcion'],
  additionalProperties: false,
}

const INTERVALO = {
  type: ['object', 'null'],
  properties: {
    series: { type: 'integer' },
    trabajo_min: { type: 'number' },
    descanso_min: { type: 'number' },
  },
  required: ['series', 'trabajo_min', 'descanso_min'],
  additionalProperties: false,
}

const DIA = {
  type: 'object',
  properties: {
    key: {
      type: 'string',
      enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
    },
    nombre: { type: 'string' },
    tipo: { type: 'string', enum: ['gimnasio', 'cardio', 'salida', 'descanso'] },
    hora_inicio: { type: ['string', 'null'], description: 'HH:MM en 24 h' },
    hora_fin: { type: ['string', 'null'], description: 'HH:MM en 24 h' },
    enfoque: { type: ['string', 'null'] },
    aviso: {
      type: ['string', 'null'],
      description: 'advertencia importante que deba salir destacada ese día',
    },
    calentamiento: { type: ['string', 'null'] },
    ejercicios: { type: 'array', items: EJERCICIO },
    prescripcion: {
      type: 'object',
      description: 'lo que toca esa sesión por semana del bloque, claves "1".."N"',
      additionalProperties: { type: 'string' },
    },
    intervalos: {
      type: ['object', 'null'],
      description: 'configuración del temporizador por semana, claves "1".."N"',
      additionalProperties: INTERVALO,
    },
  },
  required: [
    'key', 'nombre', 'tipo', 'hora_inicio', 'hora_fin', 'enfoque', 'aviso',
    'calentamiento', 'ejercicios', 'prescripcion', 'intervalos',
  ],
  additionalProperties: false,
}

const ESQUEMA = {
  type: 'object',
  properties: {
    nombre: { type: 'string' },
    descripcion: { type: 'string' },
    semanas: { type: 'integer', minimum: 1 },
    nombres_semana: {
      type: 'array',
      items: { type: 'string' },
      description: 'un nombre por semana, p. ej. Adaptación, Carga, Pico, Descarga',
    },
    dias: { type: 'array', items: DIA },
    avisos: {
      type: 'array',
      items: { type: 'string' },
      description: 'consejos generales del plan que no van atados a un día concreto',
    },
  },
  required: ['nombre', 'descripcion', 'semanas', 'nombres_semana', 'dias', 'avisos'],
  additionalProperties: false,
}

const INSTRUCCIONES = (listaCatalogo: string) => `
Este PDF es un plan de entrenamiento. Conviértelo en la estructura pedida.

Reglas:

1. Un objeto por día de la semana, los siete, en orden de lunes a domingo. Los
   días sin entrenamiento van con tipo "descanso" y ejercicios vacíos.
2. tipo: "gimnasio" si hay ejercicios de sala; "cardio" para rodajes o series
   de bici, carrera o remo hechos como sesión de cardio; "salida" para salidas
   largas; "descanso" para el día libre.
3. Si el plan trae una tabla de progresión por semanas, reparte lo que toca en
   "prescripcion", con una entrada por semana ("1", "2", …). Si el plan es de
   una sola semana, pon semanas: 1 y usa solo la clave "1".
4. Rellena "intervalos" únicamente cuando la sesión describa series de trabajo
   y recuperación con tiempos concretos (por ejemplo "5×4 min con 3 min de
   recuperación"). En cualquier otro caso, null.
5. "aviso" solo para advertencias que el plan marque como importantes para ese
   día concreto. Los consejos generales van en "avisos".
6. Para cada ejercicio de sala, elige el catalogo_id cuyo MOVIMIENTO coincida
   de verdad, no el que tenga un nombre parecido. Fíjate en el equipo: un press
   con mancuernas no es el mismo ejercicio que uno con barra. Si dudas o no hay
   nada que corresponda, pon null: es mejor dejarlo vacío que emparejarlo mal.
7. youtube_id siempre null.
8. Escribe los nombres de ejercicios y las prescripciones en castellano,
   respetando la terminología del plan.

Catálogo de ejercicios disponibles (id · nombre · equipo · músculo):
${listaCatalogo}
`.trim()

/* ------------------------------------------------------------- handler ---- */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    // 1. Autenticación: solo usuarios con sesión válida
    const cabecera = req.headers.get('Authorization')
    if (!cabecera) return json({ error: 'Falta la autenticación' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: cabecera } } },
    )
    const { data: auth, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !auth.user) {
      return json({ error: 'Sesión no válida' }, 401)
    }

    // 2. Entrada
    const { pdf_base64, nombre_archivo } = await req.json()
    if (typeof pdf_base64 !== 'string' || pdf_base64.length === 0) {
      return json({ error: 'No ha llegado ningún PDF' }, 400)
    }
    if ((pdf_base64.length * 3) / 4 > MAX_BYTES) {
      return json({ error: 'El PDF pesa más de 10 MB' }, 413)
    }

    const clave = Deno.env.get('ANTHROPIC_API_KEY')
    if (!clave) {
      return json(
        { error: 'Falta configurar ANTHROPIC_API_KEY en el proyecto' },
        500,
      )
    }

    // 3. Llamada a Claude con el PDF como documento
    const lista = (await catalogo())
      .map((e) => `${e.id} · ${e.n} · ${e.eq} · ${e.m}`)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: clave })

    const respuesta = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ESQUEMA },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf_base64,
              },
              title: nombre_archivo ?? 'plan.pdf',
            },
            { type: 'text', text: INSTRUCCIONES(lista) },
          ],
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') {
      return json(
        { error: 'El modelo no ha podido procesar este documento.' },
        422,
      )
    }
    if (respuesta.stop_reason === 'max_tokens') {
      return json(
        { error: 'El plan es demasiado largo para leerlo de una vez.' },
        422,
      )
    }

    const bloque = respuesta.content.find((b) => b.type === 'text')
    if (!bloque || bloque.type !== 'text') {
      return json({ error: 'Respuesta vacía del modelo' }, 502)
    }

    return json({
      estructura: JSON.parse(bloque.text),
      uso: respuesta.usage,
    })
  } catch (e) {
    console.error('parse-plan', e)
    return json(
      { error: e instanceof Error ? e.message : 'Error inesperado al leer el PDF' },
      500,
    )
  }
})
