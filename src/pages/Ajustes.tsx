import { useRef } from 'react'
import { Download, Moon, Sun, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Boton, Campo, Tarjeta } from '@/components/ui'
import { useAjuste } from '@/hooks/usePlan'
import { exportarTodo, importarTodo } from '@/lib/datos'
import { hayNube } from '@/lib/supabase'
import { fechaCorta } from '@/lib/utils'

export default function Ajustes() {
  const [descanso, setDescanso] = useAjuste('descanso', 90)
  const [tema, setTema] = useAjuste<'oscuro' | 'claro'>('tema', 'oscuro')
  const inputArchivo = useRef<HTMLInputElement>(null)

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

      <div className="space-y-4">
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
