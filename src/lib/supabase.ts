import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * La clave viaja en una cabecera HTTP, y ahí solo caben caracteres ASCII. Si
 * se copia desde un campo que la enseña enmascarada, lo que se pega son
 * puntitos (•) y el navegador revienta con un error incomprensible
 * ("String contains non ISO-8859-1 code point") en la primera petición.
 * Mejor detectarlo aquí y decir qué pasa.
 */
function revisarConfiguracion(): string | null {
  if (!url || !clave) return null

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())) {
    return 'La dirección del proyecto no tiene la forma esperada (https://xxxx.supabase.co, sin nada detrás).'
  }
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(clave)) {
    return 'La clave contiene caracteres que no son válidos: parece copiada de un campo que la enseña oculta, con puntitos en vez del valor real.'
  }
  if (!/^(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_publishable_[\w-]+)$/.test(clave.trim())) {
    return 'La clave no tiene la forma esperada. Copia la clave publicable (anon) entera desde Supabase.'
  }
  return null
}

export const errorConfiguracion = revisarConfiguracion()

export const supabase: SupabaseClient | null =
  url && clave && !errorConfiguracion ? createClient(url.trim(), clave.trim()) : null

export const hayNube = supabase !== null

/** true cuando hay configuración pero está mal puesta: hay que avisar. */
export const configuracionRota = Boolean(url && clave && errorConfiguracion)
