import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'

/** Franja discreta arriba cuando no hay red: lo que registres se guarda igual. */
export function AvisoSinConexion() {
  const [sinRed, setSinRed] = useState(!navigator.onLine)

  useEffect(() => {
    const conectado = () => setSinRed(false)
    const desconectado = () => setSinRed(true)
    window.addEventListener('online', conectado)
    window.addEventListener('offline', desconectado)
    return () => {
      window.removeEventListener('online', conectado)
      window.removeEventListener('offline', desconectado)
    }
  }, [])

  if (!sinRed) return null

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-300"
    >
      <CloudOff size={14} />
      Sin conexión — lo que registres se guarda y se sube al recuperarla
    </div>
  )
}
