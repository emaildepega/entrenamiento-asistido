import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, hayNube } from '@/lib/supabase'

export interface EstadoAuth {
  cargando: boolean
  sesion: Session | null
  /** true cuando no hay Supabase configurado: la app va en modo local */
  modoLocal: boolean
}

export function useAuth(): EstadoAuth {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(hayNube)

  useEffect(() => {
    if (!hayNube || !supabase) return

    void supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setSesion(s)
      setCargando(false)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  return { cargando, sesion, modoLocal: !hayNube }
}
