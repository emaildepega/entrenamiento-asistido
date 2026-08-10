import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Cargando, Tarjeta } from '@/components/ui'
import { completarConexion, testigoValido } from '@/lib/strava'

/**
 * Aterrizaje de vuelta de Strava. No se enseña casi nada: se canjea el código y
 * se vuelve a Ajustes, que es de donde se salió.
 */
export default function Strava() {
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const yaVa = useRef(false)

  useEffect(() => {
    // El código de Strava solo sirve una vez: en desarrollo React monta los
    // efectos dos veces y el segundo intento fallaría.
    if (yaVa.current) return
    yaVa.current = true

    const code = params.get('code')
    const negado = params.get('error')

    if (negado) {
      setError('No le has dado permiso a la app, así que no hay nada conectado.')
      return
    }
    if (!code) {
      setError('Strava no ha devuelto ningún código. Vuelve a intentarlo.')
      return
    }
    if (!testigoValido(params.get('state'))) {
      setError(
        'La vuelta de Strava no cuadra con la salida. Empieza otra vez desde Ajustes.',
      )
      return
    }

    void completarConexion(code)
      .then(({ nombre, importadas }) => {
        toast.success(`Strava conectado${nombre ? ` como ${nombre}` : ''}`, {
          description:
            importadas > 0
              ? `Se han traído ${importadas} actividades.`
              : 'Todavía no hay actividades que traer.',
        })
        navegar('/ajustes', { replace: true })
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'No se ha podido conectar')
      })
  }, [params, navegar])

  if (error) {
    return (
      <Tarjeta className="mt-10 flex gap-3 border-amber-500/40 bg-amber-500/10">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
        <div>
          <p className="font-bold">No se ha conectado con Strava</p>
          <p className="mt-1 text-sm text-[var(--color-suave)]">{error}</p>
          <Boton
            variante="secundario"
            className="mt-3"
            onClick={() => navegar('/ajustes', { replace: true })}
          >
            Volver a Ajustes
          </Boton>
        </div>
      </Tarjeta>
    )
  }

  return <Cargando texto="Conectando con Strava…" />
}
