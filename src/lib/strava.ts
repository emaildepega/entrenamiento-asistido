import { supabase } from './supabase'

/**
 * Lo que la app sabe de Strava. El secreto de la aplicación y los tokens viven
 * en la función `strava` del servidor; desde aquí solo se pide y se lee.
 */

export interface CuentaStrava {
  atleta_id: number
  nombre: string
  scope: string
  ultima_sync: string | null
}

export interface ActividadStrava {
  actividad_id: number
  nombre: string
  deporte: string
  empezada_en: string
  fecha_local: string
  segundos_movimiento: number
  segundos_total: number
  metros: number
  desnivel_m: number
  vatios_medios: number | null
  pulso_medio: number | null
  en_rodillo: boolean
}

/** Los deportes de Strava que cuentan como bici. */
const DEPORTES_BICI = new Set([
  'Ride',
  'VirtualRide',
  'MountainBikeRide',
  'GravelRide',
  'EBikeRide',
  'EMountainBikeRide',
  'Handcycle',
  'Velomobile',
])

/** Los de remo, que también están en el plan. */
const DEPORTES_REMO = new Set(['Rowing', 'VirtualRow', 'Kayaking', 'Canoeing'])

export function esBici(deporte: string): boolean {
  return DEPORTES_BICI.has(deporte)
}

export function esRemo(deporte: string): boolean {
  return DEPORTES_REMO.has(deporte)
}

/** Clave donde se deja el testigo anti-suplantación mientras se va a Strava. */
const CLAVE_ESTADO = 'ea:strava-state'

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Strava necesita que entres con tu cuenta')
  const { data, error } = await supabase.functions.invoke('strava', {
    body: cuerpo,
  })
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta, no en el error
    const detalle = (data as { error?: string } | null)?.error
    throw new Error(detalle ?? error.message)
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

export async function cuentaStrava(): Promise<CuentaStrava | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('strava_cuentas')
    .select('atleta_id, nombre, scope, ultima_sync')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return null
  return (data as CuentaStrava | null) ?? null
}

export async function actividadesStrava(
  desdeISO?: string,
): Promise<ActividadStrava[]> {
  if (!supabase) return []
  let consulta = supabase
    .from('strava_actividades')
    .select(
      'actividad_id, nombre, deporte, empezada_en, fecha_local, segundos_movimiento, segundos_total, metros, desnivel_m, vatios_medios, pulso_medio, en_rodillo',
    )
    .order('fecha_local', { ascending: false })
    .limit(500)

  if (desdeISO) consulta = consulta.gte('fecha_local', desdeISO)

  const { data, error } = await consulta
  if (error) return []
  return (data as ActividadStrava[] | null) ?? []
}

/**
 * Manda al usuario a Strava a dar permiso. El testigo `state` vuelve con él y
 * se comprueba, para que nadie pueda colar un código ajeno.
 */
export async function empezarConexion(): Promise<void> {
  const testigo = crypto.randomUUID()
  sessionStorage.setItem(CLAVE_ESTADO, testigo)
  const { url } = await llamar<{ url: string }>({
    accion: 'url',
    origen: window.location.origin,
    state: testigo,
  })
  window.location.href = url
}

export function testigoValido(state: string | null): boolean {
  const guardado = sessionStorage.getItem(CLAVE_ESTADO)
  sessionStorage.removeItem(CLAVE_ESTADO)
  return Boolean(guardado) && guardado === state
}

export async function completarConexion(
  code: string,
): Promise<{ nombre: string; importadas: number }> {
  return llamar<{ nombre: string; importadas: number }>({
    accion: 'conectar',
    code,
    origen: window.location.origin,
  })
}

export async function sincronizarStrava(): Promise<{ importadas: number }> {
  return llamar<{ importadas: number }>({ accion: 'sincronizar' })
}

export async function desconectarStrava(): Promise<void> {
  await llamar({ accion: 'desconectar' })
}

/** Media hora es de sobra: las salidas no aparecen en Strava al instante. */
const CADA = 30 * 60 * 1000

/**
 * Puesta al día silenciosa al abrir la app. Si falla no se dice nada: no es
 * momento de dar la lata, y en Ajustes está el botón para hacerlo a mano.
 */
export async function sincronizarSiToca(): Promise<void> {
  try {
    const cuenta = await cuentaStrava()
    if (!cuenta) return
    const ultima = cuenta.ultima_sync
      ? new Date(cuenta.ultima_sync).getTime()
      : 0
    if (Date.now() - ultima < CADA) return
    await sincronizarStrava()
  } catch {
    /* ya se reintentará en la siguiente apertura */
  }
}
