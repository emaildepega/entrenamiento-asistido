import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Download,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
  Vibrate,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { TarjetaStrava } from '@/components/TarjetaStrava'
import { Boton, Campo, Tarjeta } from '@/components/ui'
import { useAjustes } from '@/hooks/useAjustes'
import { useAuth } from '@/hooks/useAuth'
import { exportarTodo, importarTodo } from '@/lib/datos'
import { local } from '@/lib/db'
import { hayNube, supabase } from '@/lib/supabase'
import { limpiarLocal, pendientesCount, sincronizar } from '@/lib/sync'
import { desbloquearAudio, sonarAlarma } from '@/lib/alarma'
import { fechaCorta } from '@/lib/utils'

export default function Ajustes() {
  const { ajustes, cambiar } = useAjustes()
  const { sesion } = useAuth()
  const [sincronizando, setSincronizando] = useState(false)
  const [pendientes, setPendientes] = useState(0)
  const [ultimoError, setUltimoError] = useState<string | null>(null)
  const inputArchivo = useRef<HTMLInputElement>(null)

  const revisarPendientes = useCallback(async () => {
    setPendientes(await pendientesCount())
  }, [])

  useEffect(() => {
    void revisarPendientes()
  }, [revisarPendientes])

  const sincronizarAhora = async () => {
    setSincronizando(true)
    try {
      const r = await sincronizar()
      await revisarPendientes()
      setUltimoError(r.detalle)
      if (r.errores > 0) {
        toast.warning(`Quedan ${r.errores} cambios sin subir`, {
          description: r.detalle ?? undefined,
          duration: 10000,
        })
      } else {
        toast.success('Todo al día')
      }
    } catch {
      toast.error('No se ha podido conectar')
    } finally {
      setSincronizando(false)
    }
  }

  const descartarPendientes = async () => {
    if (
      !confirm(
        'Se descartan los cambios que no han podido subirse. Lo que ya está en la nube no se toca. ¿Seguir?',
      )
    ) {
      return
    }
    await local.pendientes.clear()
    await revisarPendientes()
    toast.success('Cambios pendientes descartados')
  }

  const salir = async () => {
    if (!supabase) return
    if (!confirm('¿Cerrar sesión? Se sincroniza antes de salir.')) return
    try {
      await sincronizar()
    } catch {
      toast.warning('No se ha podido sincronizar del todo antes de salir')
    }
    await limpiarLocal()
    await supabase.auth.signOut()
  }

  const exportar = async () => {
    const datos = await exportarTodo()
    const blob = new Blob([JSON.stringify(datos, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `entrenamiento-${fechaCorta(new Date()).replace(/\//g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Datos exportados')
  }

  const importar = async (archivo: File) => {
    try {
      await importarTodo(JSON.parse(await archivo.text()))
      toast.success('Datos importados. Recarga la app para verlos.')
    } catch {
      toast.error('El archivo no tiene el formato esperado')
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Ajustes"
        subtitulo={
          hayNube
            ? 'Tu configuración y tus datos van con la cuenta'
            : 'Los datos se guardan en este dispositivo'
        }
      />

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {hayNube && sesion && (
          <Tarjeta>
            <p className="mb-1 text-xs font-bold text-[var(--color-suave)] uppercase">
              Cuenta
            </p>
            <p className="mb-2 text-sm font-semibold break-all">
              {sesion.user.email}
            </p>
            <p className="mb-3 text-sm text-[var(--color-suave)]">
              Todo lo que registras se guarda primero en este dispositivo y
              luego se sube a tu cuenta. Así funciona sin cobertura en el
              gimnasio y luego lo ves igual desde el ordenador.
            </p>

            {pendientes > 0 && (
              <div className="mb-3 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-400"
                />
                <div className="text-sm">
                  <p className="font-bold">
                    {pendientes}{' '}
                    {pendientes === 1
                      ? 'cambio sin subir'
                      : 'cambios sin subir'}
                  </p>
                  <p className="mt-1 text-[var(--color-suave)]">
                    Se reintentan solos al recuperar la conexión. Si el aviso no
                    se va, descártalos: son cambios que ya están guardados aquí.
                  </p>
                  {ultimoError && (
                    <p className="mt-2 rounded-lg bg-black/20 p-2 font-mono text-[11px] break-all">
                      {ultimoError}
                    </p>
                  )}
                  <Boton
                    variante="fantasma"
                    className="mt-1 min-h-10 px-0"
                    onClick={() => void descartarPendientes()}
                  >
                    <Trash2 size={16} />
                    Descartar pendientes
                  </Boton>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Boton
                variante="secundario"
                onClick={() => void sincronizarAhora()}
                disabled={sincronizando}
              >
                <RefreshCw
                  size={18}
                  className={sincronizando ? 'animate-spin' : undefined}
                />
                {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Boton>
              <Boton variante="fantasma" onClick={() => void salir()}>
                <LogOut size={18} />
                Cerrar sesión
              </Boton>
            </div>
          </Tarjeta>
        )}

        <Tarjeta>
          <label
            htmlFor="descanso"
            className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
          >
            Descanso por defecto entre series
          </label>
          <div className="flex items-center gap-2">
            <Campo
              id="descanso"
              type="number"
              inputMode="numeric"
              value={ajustes.descanso_seg}
              onChange={(e) =>
                cambiar({ descanso_seg: Number(e.target.value) || 90 })
              }
              className="max-w-28 text-center"
            />
            <span className="text-sm text-[var(--color-suave)]">segundos</span>
          </div>
        </Tarjeta>

        {hayNube && sesion && <TarjetaStrava />}

        <Tarjeta>
          <p className="mb-1 text-xs font-bold text-[var(--color-suave)] uppercase">
            Aviso al terminar el temporizador
          </p>
          <p className="mb-3 text-sm text-[var(--color-suave)]">
            Suena y vibra cuando se acaba un descanso o una serie por tiempo,
            aunque estés en otra pantalla de la app.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              variante={ajustes.sonido ? 'primario' : 'secundario'}
              onClick={() => cambiar({ sonido: !ajustes.sonido })}
              aria-pressed={ajustes.sonido}
              className="flex-1"
            >
              {ajustes.sonido ? <Volume2 size={18} /> : <VolumeX size={18} />}
              Sonido
            </Boton>
            <Boton
              variante={ajustes.vibracion ? 'primario' : 'secundario'}
              onClick={() => cambiar({ vibracion: !ajustes.vibracion })}
              aria-pressed={ajustes.vibracion}
              className="flex-1"
            >
              <Vibrate size={18} />
              Vibración
            </Boton>
          </div>
          <Boton
            variante="fantasma"
            className="mt-1 min-h-10 px-0"
            onClick={() => {
              desbloquearAudio()
              sonarAlarma()
            }}
          >
            <BellRing size={16} />
            Probar el aviso
          </Boton>
        </Tarjeta>

        <Tarjeta>
          <p className="mb-2 text-xs font-bold text-[var(--color-suave)] uppercase">
            Tema
          </p>
          <div className="flex gap-2">
            <Boton
              variante={ajustes.tema === 'oscuro' ? 'primario' : 'secundario'}
              onClick={() => cambiar({ tema: 'oscuro' })}
              className="flex-1"
            >
              <Moon size={18} />
              Oscuro
            </Boton>
            <Boton
              variante={ajustes.tema === 'claro' ? 'primario' : 'secundario'}
              onClick={() => cambiar({ tema: 'claro' })}
              className="flex-1"
            >
              <Sun size={18} />
              Claro
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta>
          <p className="mb-1 text-xs font-bold text-[var(--color-suave)] uppercase">
            Copia de seguridad
          </p>
          <p className="mb-3 text-sm text-[var(--color-suave)]">
            Descarga tus planes y todo el histórico en un archivo. Es el seguro
            contra perder los datos si cambias de móvil.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => void exportar()}>
              <Download size={18} />
              Exportar
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => inputArchivo.current?.click()}
            >
              <Upload size={18} />
              Importar
            </Boton>
            <input
              ref={inputArchivo}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importar(f)
                e.target.value = ''
              }}
            />
          </div>
        </Tarjeta>
      </div>
    </>
  )
}
