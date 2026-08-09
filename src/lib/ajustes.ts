import { supabase, hayNube } from './supabase'

export interface Ajustes {
  tema: 'oscuro' | 'claro'
  descanso_seg: number
}

export const AJUSTES_POR_DEFECTO: Ajustes = { tema: 'oscuro', descanso_seg: 90 }

const CLAVE_LOCAL = 'ea:ajustes'

/**
 * Los ajustes se guardan en el dispositivo (para que se apliquen al instante,
 * incluso sin red) y además en la cuenta, para que el móvil y el ordenador
 * lleven la misma configuración.
 */
export function ajustesLocales(): Ajustes {
  try {
    const guardado = localStorage.getItem(CLAVE_LOCAL)
    if (guardado) {
      return {
        ...AJUSTES_POR_DEFECTO,
        ...(JSON.parse(guardado) as Partial<Ajustes>),
      }
    }

    // Antes cada ajuste iba por separado: se recuperan para no perderlos
    const antiguos: Partial<Ajustes> = {}
    const tema = localStorage.getItem('ea:tema')
    if (tema) antiguos.tema = JSON.parse(tema) as Ajustes['tema']
    const descanso = localStorage.getItem('ea:descanso')
    if (descanso) antiguos.descanso_seg = JSON.parse(descanso) as number
    return { ...AJUSTES_POR_DEFECTO, ...antiguos }
  } catch {
    return { ...AJUSTES_POR_DEFECTO }
  }
}

export function guardarLocal(ajustes: Ajustes) {
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(ajustes))
  } catch {
    /* almacenamiento bloqueado */
  }
}

export function aplicarTema(tema: Ajustes['tema']) {
  if (tema === 'claro') document.documentElement.dataset.tema = 'claro'
  else delete document.documentElement.dataset.tema
}

export async function bajarAjustes(): Promise<Ajustes | null> {
  if (!hayNube || !supabase) return null
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('ajustes')
    .select('tema, descanso_seg')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null
  return { ...AJUSTES_POR_DEFECTO, ...(data as Partial<Ajustes>) }
}

export async function subirAjustes(ajustes: Ajustes): Promise<void> {
  if (!hayNube || !supabase) return
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return

  await supabase.from('ajustes').upsert(
    { ...ajustes, user_id: userId, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
}
