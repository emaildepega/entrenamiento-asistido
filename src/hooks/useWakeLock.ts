import { useEffect, useRef } from 'react'

/**
 * Mantiene la pantalla encendida mientras `activo` sea true. Sin esto el móvil
 * se apaga cada 30 segundos en mitad de una serie.
 * La libera al desactivar, al desmontar y al ocultar la pestaña; la vuelve a
 * pedir cuando la pestaña se ve otra vez (el navegador la suelta al minimizar).
 */
export function useWakeLock(activo: boolean) {
  const bloqueo = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!activo || !('wakeLock' in navigator)) return
    let cancelado = false

    const pedir = async () => {
      if (document.visibilityState !== 'visible' || bloqueo.current) return
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelado) {
          void s.release()
          return
        }
        bloqueo.current = s
        s.addEventListener('release', () => {
          bloqueo.current = null
        })
      } catch {
        /* el navegador puede negarlo (batería baja); no es crítico */
      }
    }

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') void pedir()
    }

    void pedir()
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      void bloqueo.current?.release()
      bloqueo.current = null
    }
  }, [activo])
}
