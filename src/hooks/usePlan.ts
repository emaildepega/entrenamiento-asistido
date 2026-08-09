import { useCallback, useEffect, useState } from 'react'
import { planActivo } from '@/lib/datos'
import type { Plan } from '@/lib/tipos'

export function usePlanActivo() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    const p = await planActivo()
    setPlan(p)
    setCargando(false)
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { plan, cargando, recargar }
}

/** Ajustes guardados en el navegador (no merecen viajar a la nube). */
export function useAjuste<T>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = localStorage.getItem(`ea:${clave}`)
      return guardado ? (JSON.parse(guardado) as T) : inicial
    } catch {
      return inicial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(`ea:${clave}`, JSON.stringify(valor))
    } catch {
      /* modo incógnito con almacenamiento bloqueado */
    }
  }, [clave, valor])

  return [valor, setValor] as const
}
