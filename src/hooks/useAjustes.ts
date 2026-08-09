import { useCallback, useEffect, useState } from 'react'
import {
  ajustesLocales,
  aplicarTema,
  bajarAjustes,
  guardarLocal,
  subirAjustes,
  type Ajustes,
} from '@/lib/ajustes'

/**
 * Un único sitio para leer y escribir los ajustes. Se aplican al momento desde
 * el dispositivo y se suben a la cuenta, así el móvil y el ordenador van
 * igual. Se avisa por evento para que todas las pantallas abiertas se enteren.
 */
const EVENTO = 'ea:ajustes-cambiados'

export function useAjustes() {
  const [ajustes, setAjustes] = useState<Ajustes>(ajustesLocales)

  useEffect(() => {
    const alCambiar = () => setAjustes(ajustesLocales())
    window.addEventListener(EVENTO, alCambiar)
    window.addEventListener('storage', alCambiar)
    return () => {
      window.removeEventListener(EVENTO, alCambiar)
      window.removeEventListener('storage', alCambiar)
    }
  }, [])

  const cambiar = useCallback((cambios: Partial<Ajustes>) => {
    const nuevos = { ...ajustesLocales(), ...cambios }
    guardarLocal(nuevos)
    aplicarTema(nuevos.tema)
    setAjustes(nuevos)
    window.dispatchEvent(new Event(EVENTO))
    void subirAjustes(nuevos)
  }, [])

  return { ajustes, cambiar }
}

/** Al entrar, la cuenta manda: trae los ajustes guardados en ella. */
export async function sincronizarAjustes() {
  const remotos = await bajarAjustes()
  if (remotos) {
    guardarLocal(remotos)
    aplicarTema(remotos.tema)
    window.dispatchEvent(new Event(EVENTO))
  } else {
    // Primera vez con esta cuenta: se sube lo que haya en el dispositivo
    await subirAjustes(ajustesLocales())
  }
}
