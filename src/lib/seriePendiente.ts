/**
 * Cuando una serie por tiempo termina, la barra del temporizador no escribe en
 * la base de datos: deja aquí el resultado y la tarjeta del ejercicio lo recoge
 * en cuanto está en pantalla. Así funciona igual si el aviso te pilla en otra
 * pestaña o incluso con la app recargada.
 */

export interface SeriePendiente {
  sesionId: string
  slug: string
  serie: number
  segundos: number
}

const CLAVE = 'ea:series-pendientes'
export const EVENTO_PENDIENTES = 'ea:series-pendientes-cambiadas'

function leer(): SeriePendiente[] {
  try {
    const bruto = localStorage.getItem(CLAVE)
    if (!bruto) return []
    const lista = JSON.parse(bruto) as SeriePendiente[]
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function escribir(lista: SeriePendiente[]) {
  try {
    if (lista.length > 0) localStorage.setItem(CLAVE, JSON.stringify(lista))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* almacenamiento bloqueado */
  }
  window.dispatchEvent(new Event(EVENTO_PENDIENTES))
}

export function dejarPendiente(p: SeriePendiente) {
  const lista = leer().filter(
    (x) =>
      !(
        x.sesionId === p.sesionId &&
        x.slug === p.slug &&
        x.serie === p.serie
      ),
  )
  lista.push(p)
  escribir(lista)
}

/** Se lleva (y borra) lo pendiente de ese ejercicio en esa sesión. */
export function tomarPendientes(
  sesionId: string,
  slug: string,
): SeriePendiente[] {
  const lista = leer()
  const mias = lista.filter((x) => x.sesionId === sesionId && x.slug === slug)
  if (mias.length === 0) return []
  escribir(lista.filter((x) => !mias.includes(x)))
  return mias
}
