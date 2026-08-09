import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Cliente de Supabase, o null si todavía no hay proyecto configurado.
 * Mientras sea null la app funciona en modo local (los datos viven en el
 * navegador). En cuanto se rellenan las dos variables de entorno, la app pasa
 * sola a modo cuenta.
 */
export const supabase: SupabaseClient | null =
  url && clave ? createClient(url, clave) : null

export const hayNube = supabase !== null
