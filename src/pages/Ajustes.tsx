import { useRef, useState } from 'react'
import { Download, LogOut, Moon, RefreshCw, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Boton, Campo, Tarjeta } from '@/components/ui'
import { useAjuste } from '@/hooks/usePlan'
import { useAuth } from '@/hooks/useAuth'
import { exportarTodo, importarTodo } from '@/lib/datos'
import { hayNube, supabase } from '@/lib/supabase'
import { limpiarLocal, sincronizar } from '@/lib/sync'
import { fechaCorta } from '@/lib/utils'

export default function Ajustes() {
  const [descanso, setDescanso] = useAjuste('descanso', 90)
  const [tema, setTema] = useAjuste<'oscuro' | 'claro'>('tema', 'oscuro')
  const [sincronizando, setSincronizando] = useState(false)
  const { sesion } = useAuth()
  const inputArchivo = useRef<HTMLInputElement>(null)

  const sincronizarAhora = async () => {
    setSincronizando(true)
    try {
      const r = await sincronizar()
      toast.success(
        r.errores > 0
          ? `Sincronizado con ${r.errores} error(es)`
          : `Sincronizado: ${r.subidos} subidos, ${r.bajados} bajados`,
      )
    } catch {
      toast.error('No se ha podido sincronizar')
    } finally {
      setSincronizando(false)
    }
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

  const cambiarTema = (nuevo: 'oscuro' | 'claro') => {
    setTema(nuevo)
    if (nuevo === 'claro') document.documentElement.dataset.tema = 'claro'
    else delete document.documentElement.dataset.tema
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
      const datos = JSON.parse(await archivo.text())
      await importarTodo(datos)
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
            ? 'Los datos se sincronizan con tu cuenta'
            : 'Los datos se guardan en este dispositivo'
        }
      />

      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        {hayNube && sesion && (
          <Tarjeta>
            <p className="mb-1 text-xs font-bold text-[var(--color-suave)] uppercase">
              Cuenta
            </p>
            <p className="mb-3 text-sm font-semibold break-all">
              {sesion.user.email}
            </p>
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
              value={descanso}
              onChange={(e) => setDescanso(Number(e.target.value) || 90)}
              className="max-w-28 text-center"
            />
            <span className="text-sm text-[var(--color-suave)]">segundos</span>
          </div>
        </Tarjeta>

        <Tarjeta>
          <p className="mb-2 text-xs font-bold text-[var(--color-suave)] uppercase">
            Tema
          </p>
          <div className="flex gap-2">
            <Boton
              variante={tema === 'oscuro' ? 'primario' : 'secundario'}
              onClick={() => cambiarTema('oscuro')}
              className="flex-1"
            >
              <Moon size={18} />
              Oscuro
            </Boton>
            <Boton
              variante={tema === 'claro' ? 'primario' : 'secundario'}
              onClick={() => cambiarTema('claro')}
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
