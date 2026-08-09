import { useCallback, useEffect, useState } from 'react'
import { parseISO } from 'date-fns'
import { Check, FileUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { SelectorFecha } from '@/components/SelectorFecha'
import { Boton, Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import {
  activarPlan,
  borrarPlan,
  guardarPlan,
  listarPlanes,
  planActivo,
} from '@/lib/datos'
import { aISO } from '@/lib/plan'
import { fechaCorta } from '@/lib/utils'
import type { Plan } from '@/lib/tipos'

export default function Planes() {
  const [planes, setPlanes] = useState<Plan[] | null>(null)

  const recargar = useCallback(async () => {
    // Asegura que el plan de partida existe aunque se entre directamente aquí
    await planActivo()
    setPlanes(await listarPlanes())
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  if (!planes) return <Cargando />

  const cambiarInicio = async (plan: Plan, fecha: Date) => {
    await guardarPlan({ ...plan, fecha_inicio: aISO(fecha) })
    await recargar()
    toast.success(`Bloque desde el ${fechaCorta(fecha)}`)
  }

  const eliminar = async (plan: Plan) => {
    if (
      !confirm(
        `¿Eliminar «${plan.nombre}»? Se borran también las sesiones registradas con él.`,
      )
    ) {
      return
    }
    await borrarPlan(plan.id)
    await recargar()
    toast.success('Plan eliminado')
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Planes"
        subtitulo={`${planes.length} ${planes.length === 1 ? 'plan guardado' : 'planes guardados'}`}
      />

      <Tarjeta className="mb-6 border-dashed text-center">
        <FileUp className="mx-auto mb-2 text-[var(--color-suave)]" size={26} />
        <p className="font-semibold">Subir un plan en PDF</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-suave)]">
          Se activa en cuanto conectemos la cuenta de Supabase con la clave de
          Anthropic. De momento puedes usar el plan que ya está cargado.
        </p>
        <Boton variante="secundario" className="mt-3" disabled>
          Subir plan
        </Boton>
      </Tarjeta>

      <ul className="space-y-3">
        {planes.map((p) => (
          <li key={p.id}>
            <Tarjeta className={p.activo ? 'border-[var(--color-acento)]' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{p.nombre}</h2>
                    {p.activo && <Etiqueta tono="acento">Activo</Etiqueta>}
                  </div>
                  <p className="text-sm text-[var(--color-suave)]">
                    {p.descripcion}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-suave)]">
                    {p.semanas} semanas ·{' '}
                    {p.estructura.dias.filter((d) => d.tipo !== 'descanso').length}{' '}
                    sesiones por semana
                  </p>
                </div>
                <button
                  onClick={() => void eliminar(p)}
                  aria-label={`Eliminar ${p.nombre}`}
                  className="rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="min-w-40 flex-1">
                  <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
                    El bloque empieza
                  </label>
                  <SelectorFecha
                    valor={parseISO(p.fecha_inicio)}
                    onCambiar={(f) => void cambiarInicio(p, f)}
                    etiqueta="Inicio del bloque"
                  />
                </div>
                {!p.activo && (
                  <Boton
                    variante="secundario"
                    onClick={async () => {
                      await activarPlan(p.id)
                      await recargar()
                      toast.success(`«${p.nombre}» activado`)
                    }}
                  >
                    <Check size={18} />
                    Activar
                  </Boton>
                )}
              </div>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </>
  )
}
