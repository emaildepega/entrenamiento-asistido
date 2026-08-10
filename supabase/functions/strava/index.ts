// Conexión con Strava. Todo lo que toca el secreto de la aplicación o los
// tokens del usuario pasa por aquí: el navegador nunca los ve.
//
// Acciones:
//   url          → devuelve la dirección a la que mandar al usuario a dar permiso
//   conectar     → cambia el código de vuelta por los tokens y hace la primera importación
//   sincronizar  → trae las actividades nuevas
//   desconectar  → retira el permiso en Strava y borra lo guardado

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AUTORIZAR = 'https://www.strava.com/oauth/authorize'
const TOKEN = 'https://www.strava.com/oauth/token'
const API = 'https://www.strava.com/api/v3'

/** Permiso mínimo para leer también las actividades marcadas como privadas. */
const SCOPE = 'activity:read_all'

/** Cuántos días hacia atrás se traen la primera vez. */
const DIAS_PRIMERA_VEZ = 180

interface Cuenta {
  user_id: string
  atleta_id: number
  nombre: string
  access_token: string
  refresh_token: string
  expira_en: string
  scope: string
  ultima_sync: string | null
}

interface ActividadStrava {
  id: number
  name?: string
  sport_type?: string
  type?: string
  start_date?: string
  start_date_local?: string
  moving_time?: number
  elapsed_time?: number
  distance?: number
  total_elevation_gain?: number
  average_watts?: number
  average_heartrate?: number
  trainer?: boolean
}

function faltaConfiguracion(): string | null {
  if (!Deno.env.get('STRAVA_CLIENT_ID')) return 'STRAVA_CLIENT_ID'
  if (!Deno.env.get('STRAVA_CLIENT_SECRET')) return 'STRAVA_CLIENT_SECRET'
  return null
}

/** El redirect_uri tiene que ser idéntico al pedir permiso y al canjear. */
function destinoDeVuelta(origen: string): string {
  return `${origen.replace(/\/$/, '')}/strava`
}

async function canjear(cuerpo: Record<string, string>) {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('STRAVA_CLIENT_ID'),
      client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
      ...cuerpo,
    }),
  })
  const datos = await res.json()
  if (!res.ok) {
    throw new Error(
      datos?.message ?? 'Strava ha rechazado la petición de acceso',
    )
  }
  return datos as {
    access_token: string
    refresh_token: string
    expires_at: number
    scope?: string
    athlete?: { id: number; firstname?: string; lastname?: string }
  }
}

/**
 * Devuelve un access_token utilizable, renovándolo si le queda poco. Strava
 * puede cambiar también el refresh_token al renovar, así que se guarda siempre
 * el que venga de vuelta.
 */
async function tokenUtil(
  admin: ReturnType<typeof createClient>,
  cuenta: Cuenta,
): Promise<string> {
  const margen = 5 * 60 * 1000
  if (new Date(cuenta.expira_en).getTime() - Date.now() > margen) {
    return cuenta.access_token
  }

  const nuevo = await canjear({
    grant_type: 'refresh_token',
    refresh_token: cuenta.refresh_token,
  })

  await admin
    .from('strava_cuentas')
    .update({
      access_token: nuevo.access_token,
      refresh_token: nuevo.refresh_token,
      expira_en: new Date(nuevo.expires_at * 1000).toISOString(),
    })
    .eq('user_id', cuenta.user_id)

  return nuevo.access_token
}

/** La fecha del día tal y como la vivió quien entrenaba, no en UTC. */
function fechaLocal(a: ActividadStrava): string {
  const local = a.start_date_local ?? a.start_date ?? ''
  return local.slice(0, 10)
}

async function sincronizar(
  admin: ReturnType<typeof createClient>,
  cuenta: Cuenta,
): Promise<{ importadas: number }> {
  const token = await tokenUtil(admin, cuenta)

  // Se vuelve una semana atrás de la última vez: por si alguna salida se subió
  // tarde o se corrigió después.
  const desde = cuenta.ultima_sync
    ? Math.floor(new Date(cuenta.ultima_sync).getTime() / 1000) - 7 * 86400
    : Math.floor((Date.now() - DIAS_PRIMERA_VEZ * 86400 * 1000) / 1000)

  const filas: Record<string, unknown>[] = []
  for (let pagina = 1; pagina <= 10; pagina++) {
    const res = await fetch(
      `${API}/athlete/activities?after=${desde}&per_page=100&page=${pagina}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (res.status === 429) {
      throw new Error(
        'Strava ha cortado por exceso de peticiones. Prueba dentro de un rato.',
      )
    }
    if (!res.ok) throw new Error('Strava no ha devuelto las actividades')

    const lote = (await res.json()) as ActividadStrava[]
    for (const a of lote) {
      if (!a.id || !a.start_date) continue
      filas.push({
        user_id: cuenta.user_id,
        actividad_id: a.id,
        nombre: a.name ?? '',
        deporte: a.sport_type ?? a.type ?? '',
        empezada_en: a.start_date,
        fecha_local: fechaLocal(a),
        segundos_movimiento: a.moving_time ?? 0,
        segundos_total: a.elapsed_time ?? 0,
        metros: a.distance ?? 0,
        desnivel_m: a.total_elevation_gain ?? 0,
        vatios_medios: a.average_watts ?? null,
        pulso_medio: a.average_heartrate ?? null,
        en_rodillo: a.trainer ?? false,
      })
    }
    if (lote.length < 100) break
  }

  if (filas.length > 0) {
    const { error } = await admin
      .from('strava_actividades')
      .upsert(filas, { onConflict: 'user_id,actividad_id' })
    if (error) throw new Error(error.message)
  }

  await admin
    .from('strava_cuentas')
    .update({ ultima_sync: new Date().toISOString() })
    .eq('user_id', cuenta.user_id)

  return { importadas: filas.length }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const falta = faltaConfiguracion()
    if (falta) {
      return json(
        { error: `Falta configurar ${falta} en los secretos del proyecto` },
        500,
      )
    }

    const cabecera = req.headers.get('Authorization')
    if (!cabecera) return json({ error: 'Falta la autenticación' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: cabecera } } },
    )
    const { data: auth, error: errorAuth } = await supabase.auth.getUser()
    if (errorAuth || !auth.user) return json({ error: 'Sesión no válida' }, 401)
    const userId = auth.user.id

    // Los tokens de Strava no pasan por RLS: los gestiona solo esta función.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    const { accion, code, origen, state } = await req.json()

    /* ------------------------------------------------------------- url --- */
    if (accion === 'url') {
      if (typeof origen !== 'string' || !/^https?:\/\//.test(origen)) {
        return json({ error: 'Origen no válido' }, 400)
      }
      const url = new URL(AUTORIZAR)
      url.searchParams.set('client_id', Deno.env.get('STRAVA_CLIENT_ID')!)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('redirect_uri', destinoDeVuelta(origen))
      url.searchParams.set('approval_prompt', 'auto')
      url.searchParams.set('scope', SCOPE)
      if (typeof state === 'string' && state) url.searchParams.set('state', state)
      return json({ url: url.toString() })
    }

    /* -------------------------------------------------------- conectar --- */
    if (accion === 'conectar') {
      if (typeof code !== 'string' || !code) {
        return json({ error: 'Falta el código de Strava' }, 400)
      }
      const datos = await canjear({
        grant_type: 'authorization_code',
        code,
      })

      if (!datos.scope?.includes('activity:read')) {
        return json(
          {
            error:
              'No has dado permiso para leer las actividades, así que no hay nada que traer.',
          },
          400,
        )
      }

      const nombre = [datos.athlete?.firstname, datos.athlete?.lastname]
        .filter(Boolean)
        .join(' ')

      const { error } = await admin.from('strava_cuentas').upsert(
        {
          user_id: userId,
          atleta_id: datos.athlete?.id ?? 0,
          nombre,
          access_token: datos.access_token,
          refresh_token: datos.refresh_token,
          expira_en: new Date(datos.expires_at * 1000).toISOString(),
          scope: datos.scope ?? '',
          ultima_sync: null,
        },
        { onConflict: 'user_id' },
      )
      if (error) return json({ error: error.message }, 500)

      const cuenta = { ...(await leerCuenta(admin, userId))! }
      const resultado = await sincronizar(admin, cuenta)
      return json({ conectado: true, nombre, ...resultado })
    }

    /* ----------------------------------------------------- sincronizar --- */
    if (accion === 'sincronizar') {
      const cuenta = await leerCuenta(admin, userId)
      if (!cuenta) return json({ error: 'No hay ninguna cuenta conectada' }, 404)
      const resultado = await sincronizar(admin, cuenta)
      return json(resultado)
    }

    /* ----------------------------------------------------- desconectar --- */
    if (accion === 'desconectar') {
      const cuenta = await leerCuenta(admin, userId)
      if (cuenta) {
        // Se retira el permiso en Strava, no solo por aquí
        try {
          const token = await tokenUtil(admin, cuenta)
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
        } catch {
          /* si Strava no responde, al menos se borra lo de aquí */
        }
        await admin.from('strava_cuentas').delete().eq('user_id', userId)
        await admin.from('strava_actividades').delete().eq('user_id', userId)
      }
      return json({ desconectado: true })
    }

    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    console.error('strava', e)
    return json(
      {
        error:
          e instanceof Error ? e.message : 'Error inesperado hablando con Strava',
      },
      500,
    )
  }
})

async function leerCuenta(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<Cuenta | null> {
  const { data } = await admin
    .from('strava_cuentas')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Cuenta | null) ?? null
}
