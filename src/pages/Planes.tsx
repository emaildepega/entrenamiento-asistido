import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  ClipboardList,
  FileUp,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { ImportarPlan } from '@/components/ImportarPlan'
import { Boton, Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import {
  activarPlan,
  borrarPlan,
  cargarPlanDeEjemplo,
  listarPlanes,
  planActivo,
} from '@/lib/datos'
import { hayNube } from '@/lib/supabase'
import { fechaCorta } from '@/lib/utils'
import type { Plan } from '@/lib/tipos'

export default function Planes() {
  const [planes, setPlanes] = useState<Plan[] | null>(null)
  const [importando, setImportando] = useState(false)

  const recargar = useCallback(async () => {
    // En modo local esto además deja cargado el plan de ejemplo
    await planActivo()
    setPlanes(await listarPlanes())
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  if (!planes) return <Cargando />

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

  const vacio = planes.length === 0

  return (
    <>
      <EncabezadoPagina
        titulo="Planes"
        subtitulo={
          vacio
            ? 'Todavía no tienes ningún plan'
            : `${planes.length} ${planes.length === 1 ? 'plan guardado' : 'planes guardados'}`
        }
      />

      {/* ------------------------------------------------- cómo empezar */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Tarjeta className="flex flex-col border-dashed text-center">
          <FileUp className="mx-auto mb-2 text-[var(--color-suave)]" size={26} />
          <p className="font-semibold">Subir un PDF</p>
          <p className="mx-auto mt-1 max-w-xs flex-1 text-sm text-[var(--color-suave)]">
            {hayNube
              ? 'La IA lo lee y te enseña lo que ha entendido para que lo corrijas antes de guardarlo.'
              : 'Necesitas tener la cuenta configurada para poder subir planes.'}
          </p>
          <Boton
            variante="secundario"
            className="mt-3"
            disabled={!hayNube}
            onClick={() => setImportando(true)}
          >
            Subir plan
          </Boton>
        </Tarjeta>

        <Tarjeta className="flex flex-col border-dashed text-center">
          <Pencil className="mx-auto mb-2 text-[var(--color-suave)]" size={26} />
          <p className="font-semibold">Crearlo a mano</p>
          <p className="mx-auto mt-1 max-w-xs flex-1 text-sm text-[var(--color-suave)]">
            Montas los días y eliges los ejercicios: de los que ya has usado, del
            catálogo, o escribiendo uno nuevo y dejando que la IA le busque
            animación y vídeo.
          </p>
          <Link to="/plan/nuevo" className="mt-3">
            <Boton variante="secundario" className="w-full">
              Crear plan
            </Boton>
          </Link>
        </Tarjeta>
      </div>

      <ImportarPlan
        abierto={importando}
        onCerrar={() => setImportando(false)}
        onGuardado={() => void recargar()}
      />

      {/* ------------------------------------------------------- vacío */}
      {vacio ? (
        <Tarjeta className="py-10 text-center">
          <ClipboardList
            className="mx-auto mb-3 text-[var(--color-suave)]"
            size={32}
          />
          <p className="font-semibold">Aquí aparecerán tus planes</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-suave)]">
            Sube el PDF de tu plan o créalo a mano. Si prefieres empezar viendo
            cómo funciona, puedes cargar un plan de ejemplo.
          </p>
          <Boton
            variante="fantasma"
            className="mt-3"
            onClick={async () => {
              await cargarPlanDeEjemplo()
              await recargar()
              toast.success('Plan de ejemplo cargado')
            }}
          >
            <Sparkles size={18} />
            Cargar plan de ejemplo
          </Boton>
        </Tarjeta>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {planes.map((p) => (
            <li key={p.id}>
              <Tarjeta
                className={`p-0 ${p.activo ? 'border-[var(--color-acento)]' : ''}`}
              >
                <Link
                  to={`/plan/${p.id}`}
                  className="flex items-start gap-3 p-4 hover:opacity-80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{p.nombre}</h2>
                      {p.activo && <Etiqueta tono="acento">Activo</Etiqueta>}
                    </div>
                    {p.descripcion && (
                      <p className="text-sm text-[var(--color-suave)]">
                        {p.descripcion}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[var(--color-suave)]">
                      {p.semanas} {p.semanas === 1 ? 'semana' : 'semanas'} ·{' '}
                      {
                        p.estructura.dias.filter((d) => d.tipo !== 'descanso')
                          .length
                      }{' '}
                      sesiones · empieza el {fechaCorta(p.fecha_inicio)}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="mt-1 shrink-0 text-[var(--color-suave)]"
                  />
                </Link>

                <div className="flex items-center gap-2 border-t border-[var(--color-borde)] p-3">
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
                  <Link to={`/plan/${p.id}`} className="flex-1">
                    <Boton variante="fantasma" className="w-full">
                      Ver el plan completo
                    </Boton>
                  </Link>
                  <button
                    onClick={() => void eliminar(p)}
                    aria-label={`Eliminar ${p.nombre}`}
                    className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
