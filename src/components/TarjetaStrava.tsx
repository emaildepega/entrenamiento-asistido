import { useCallback, useEffect, useState } from 'react'
import { Bike, Link2, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Tarjeta } from './ui'
import {
  actividadesStrava,
  cuentaStrava,
  desconectarStrava,
  empezarConexion,
  esBici,
  sincronizarStrava,
  type CuentaStrava,
} from '@/lib/strava'
import { fechaCorta } from '@/lib/utils'

/**
 * Conectar la cuenta de Strava. Con esto las salidas en bici dejan de
 * apuntarse a mano: se traen solas y alimentan el gráfico de horas.
 */
export function TarjetaStrava() {
  const [cuenta, setCuenta] = useState<CuentaStrava | null>(null)
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState(false)
  const [cuantas, setCuantas] = useState(0)

  const revisar = useCallback(async () => {
    const c = await cuentaStrava()
    setCuenta(c)
    if (c) {
      const actividades = await actividadesStrava()
      setCuantas(actividades.filter((a) => esBici(a.deporte)).length)
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    void revisar()
  }, [revisar])

  const conectar = async () => {
    setTrabajando(true)
    try {
      await empezarConexion()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido conectar')
      setTrabajando(false)
    }
  }

  const sincronizar = async () => {
    setTrabajando(true)
    try {
      const { importadas } = await sincronizarStrava()
      await revisar()
      toast.success(
        importadas > 0
          ? `${importadas} actividades revisadas`
          : 'No hay nada nuevo en Strava',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Strava no ha respondido')
    } finally {
      setTrabajando(false)
    }
  }

  const desconectar = async () => {
    if (
      !confirm(
        '¿Desconectar Strava? Se retira el permiso y se borran las actividades traídas. Lo que apuntaste a mano no se toca.',
      )
    ) {
      return
    }
    setTrabajando(true)
    try {
      await desconectarStrava()
      setCuenta(null)
      setCuantas(0)
      toast.success('Strava desconectado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido desconectar')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Tarjeta>
      <p className="mb-1 flex items-center gap-2 text-xs font-bold text-[var(--color-suave)] uppercase">
        <Bike size={14} />
        Strava
      </p>

      {cargando ? (
        <p className="text-sm text-[var(--color-suave)]">Comprobando…</p>
      ) : cuenta ? (
        <>
          <p className="mb-1 text-sm font-semibold">
            Conectado{cuenta.nombre ? ` como ${cuenta.nombre}` : ''}
          </p>
          <p className="mb-3 text-sm text-[var(--color-suave)]">
            {cuantas > 0
              ? `${cuantas} salidas en bici traídas.`
              : 'Todavía no hay salidas en bici.'}{' '}
            {cuenta.ultima_sync
              ? `Última comprobación: ${fechaCorta(cuenta.ultima_sync)}.`
              : 'Sin comprobar aún.'}{' '}
            Se pone al día solo al abrir la app.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="secundario"
              onClick={() => void sincronizar()}
              disabled={trabajando}
            >
              <RefreshCw size={18} className={trabajando ? 'animate-spin' : undefined} />
              Traer lo nuevo
            </Boton>
            <Boton
              variante="fantasma"
              onClick={() => void desconectar()}
              disabled={trabajando}
            >
              <Unlink size={18} />
              Desconectar
            </Boton>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-[var(--color-suave)]">
            Conecta tu cuenta y las salidas en bici se traen solas: dejas de
            apuntar la duración a mano y el gráfico de horas se llena con lo que
            de verdad has rodado. Si tienes Garmin, sincronízalo con Strava y
            entra por aquí igual.
          </p>
          <Boton onClick={() => void conectar()} disabled={trabajando}>
            <Link2 size={18} />
            Conectar con Strava
          </Boton>
        </>
      )}
    </Tarjeta>
  )
}
