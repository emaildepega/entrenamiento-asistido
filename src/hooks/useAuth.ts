import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, hayNube } from '@/lib/supabase'

export interface EstadoAuth {
  cargando: boolean
  sesion: Session | null
  /** true cuando no hay Supabase configurado: la app va en modo local */
  modoLocal: boolean
  /** la comprobación se quedó colgada y se ha seguido sin ella */
  seAtasco: boolean
}

/** Si la comprobación tarda más que esto, se sigue adelante sin ella. */
const LIMITE_MS = 8000

export function useAuth(): EstadoAuth {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(hayNube)
  const [seAtasco, setSeAtasco] = useState(false)

  useEffect(() => {
    if (!hayNube || !supabase) return

    let resuelto = false
    const acabar = (s: Session | null) => {
      resuelto = true
      setSesion(s)
      setCargando(false)
    }

    /*
     * Supabase coordina la renovación del token entre pestañas con un cerrojo
     * del navegador. Si una pestaña o la app instalada se cierra de golpe
     * mientras lo tiene cogido, la comprobación se queda esperando para
     * siempre y la app no pasa de "Comprobando la sesión". Con este límite se
     * sigue adelante y se ofrece volver a entrar, en vez de dejar la pantalla
     * colgada sin salida.
     */
    const temporizador = setTimeout(() => {
      if (!resuelto) {
        setSeAtasco(true)
        acabar(null)
      }
    }, LIMITE_MS)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!resuelto) acabar(data.session)
      })
      .catch(() => {
        if (!resuelto) acabar(null)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      // Un inicio de sesión posterior sí manda, aunque antes se hubiera atascado
      if (s) setSeAtasco(false)
      acabar(s)
    })

    return () => {
      clearTimeout(temporizador)
      sub.subscription.unsubscribe()
    }
  }, [])

  return { cargando, sesion, modoLocal: !hayNube, seAtasco }
}

/** Última bala: borra la sesión guardada para poder entrar de cero. */
export async function olvidarSesion() {
  try {
    for (const clave of Object.keys(localStorage)) {
      if (clave.startsWith('sb-')) localStorage.removeItem(clave)
    }
    await supabase?.auth.signOut({ scope: 'local' })
  } catch {
    /* da igual: lo importante es que las claves ya no están */
  }
  location.reload()
}
