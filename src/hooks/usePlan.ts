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
