// Dado uno o varios nombres de ejercicio, devuelve la animación del catálogo
// que le corresponde y un vídeo de demostración de YouTube.
//
// Los dos resultados se comprueban antes de devolverlos: el id de animación
// contra el catálogo real, y el vídeo contra la API de YouTube. Lo que no se
// pueda verificar vuelve como null, para no dejar enlaces rotos.

import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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
  if (!res.ok) throw new Error('No se pudo descargar el catálogo')
  const todos = await res.json()
  catalogoCache = todos
    .filter((e: { images?: string[] }) => (e.images?.length ?? 0) >= 2)
    .map((e: {
      id: string
      name: string
      equipment?: string
      primaryMuscles?: string[]
    }) => ({
      id: e.id,
      n: e.name,
      eq: e.equipment ?? 'other',
      m: e.primaryMuscles?.[0] ?? 'other',
    }))
  return catalogoCache!
}

/** Un vídeo solo se acepta si YouTube confirma que existe. */
async function videoExiste(id: string): Promise<boolean> {
  if (!/^[\w-]{11}$/.test(id)) return false
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
    )
    return res.ok
  } catch {
    return false
  }
}

const ESQUEMA = {
  type: 'object',
  properties: {
    resultados: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'el nombre que se te dio, tal cual' },
          catalogo_id: {
            type: ['string', 'null'],
            description:
              'id del catálogo cuyo movimiento coincide de verdad, o null',
          },
          youtube_id: {
            type: ['string', 'null'],
            description:
              'id de 11 caracteres de un vídeo de demostración real que hayas encontrado buscando, o null si no estás seguro',
          },
        },
        required: ['nombre', 'catalogo_id', 'youtube_id'],
        additionalProperties: false,
      },
    },
  },
  required: ['resultados'],
  additionalProperties: false,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const cabecera = req.headers.get('Authorization')
    if (!cabecera) return json({ error: 'Falta la autenticación' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: cabecera } } },
    )
    const { data: auth, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !auth.user) return json({ error: 'Sesión no válida' }, 401)

    const { nombres } = await req.json()
    if (!Array.isArray(nombres) || nombres.length === 0) {
      return json({ error: 'No se ha indicado ningún ejercicio' }, 400)
    }
    if (nombres.length > 20) {
      return json({ error: 'Máximo 20 ejercicios de una vez' }, 400)
    }

    const clave = Deno.env.get('ANTHROPIC_API_KEY')
    if (!clave) {
      return json({ error: 'Falta configurar ANTHROPIC_API_KEY' }, 500)
    }

    const lista = (await catalogo())
      .map((e) => `${e.id} · ${e.n} · ${e.eq} · ${e.m}`)
      .join('\n')

    const anthropic = new Anthropic({ apiKey: clave })

    const respuesta = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: ESQUEMA },
      },
      // El catálogo son ~20k tokens que no cambian nunca: va en el system y se
      // cachea, así las búsquedas seguidas cuestan una décima parte.
      system: [
        {
          type: 'text',
          text: `Eres un entrenador que empareja ejercicios con un catálogo de animaciones.

Catálogo (id · nombre · equipo · músculo):
${lista}`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Para cada uno de estos ejercicios de gimnasio, en castellano:

${nombres.map((n: string) => `- ${n}`).join('\n')}

1. Elige del catálogo el id cuyo MOVIMIENTO coincida de verdad, mirando también
   el equipo (una mancuerna no es una barra, una banda no es una polea). Si no
   hay ninguno que corresponda, pon null: es mejor vacío que mal.
2. Busca en la web un vídeo de YouTube que demuestre la ejecución de ese
   ejercicio concreto y devuelve su id de 11 caracteres. Si no encuentras uno
   del que estés seguro, pon null. No te inventes ids.`,
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') {
      return json({ error: 'No se ha podido completar la búsqueda' }, 422)
    }

    const bloque = respuesta.content.find((b) => b.type === 'text')
    if (!bloque || bloque.type !== 'text') {
      return json({ error: 'Respuesta vacía del modelo' }, 502)
    }

    const { resultados } = JSON.parse(bloque.text) as {
      resultados: {
        nombre: string
        catalogo_id: string | null
        youtube_id: string | null
      }[]
    }

    // Se comprueba todo antes de devolverlo
    const idsValidos = new Set((await catalogo()).map((e) => e.id))
    const verificados = await Promise.all(
      resultados.map(async (r) => ({
        nombre: r.nombre,
        catalogo_id:
          r.catalogo_id && idsValidos.has(r.catalogo_id) ? r.catalogo_id : null,
        youtube_id:
          r.youtube_id && (await videoExiste(r.youtube_id))
            ? r.youtube_id
            : null,
      })),
    )

    return json({ resultados: verificados, uso: respuesta.usage })
  } catch (e) {
    console.error('buscar-ejercicio', e)
    return json(
      {
        error:
          e instanceof Error ? e.message : 'Error inesperado al buscar el ejercicio',
      },
      500,
    )
  }
})
