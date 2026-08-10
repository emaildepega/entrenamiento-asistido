import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { Cargando, Etiqueta, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import {
  borrarSesion,
  listarSesiones,
  resumirSerie,
  seriesDe,
} from '@/lib/datos'
import { iconoDeDia } from '@/lib/iconos'
import { fechaCorta } from '@/lib/utils'
import { NOMBRES_DIA, type Serie, type Sesion } from '@/lib/tipos'

export default function Historial() {
  const { plan } = usePlanActivo()
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [series, setSeries] = useState<Serie[]>([])

  const recargar = useCallback(async () => {
    setSesiones(await listarSesiones())
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    if (!abierta) return setSeries([])
    void seriesDe(abierta).then((s) => setSeries(s.filter((x) => x.hecha)))
  }, [abierta])

  if (!sesiones) return <Cargando />

  const registradas = sesiones.filter((s) => s.estado !== 'parcial')

  const eliminar = async (s: Sesion) => {
    if (!confirm(`¿Borrar la sesión del ${fechaCorta(s.fecha)}?`)) return
    await borrarSesion(s.id)
    await recargar()
    toast.success('Sesión borrada')
  }

  return (
    <>
      <Link
        to="/progreso"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-suave)]"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <EncabezadoPagina
        titulo="Historial"
        subtitulo={`${registradas.length} ${registradas.length === 1 ? 'sesión' : 'sesiones'}`}
      />

      {registradas.length === 0 ? (
        <Tarjeta className="py-10 text-center text-sm text-[var(--color-suave)]">
          Aún no has cerrado ninguna sesión.
        </Tarjeta>
      ) : (
        <ul className="space-y-3">
          {registradas.map((s) => {
            const dia = plan?.estructura.dias.find((d) => d.key === s.dia_key)
            const Icono = dia ? iconoDeDia(dia) : null
            const esta = abierta === s.id
            return (
              <li key={s.id}>
                <Tarjeta>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setAbierta(esta ? null : s.id)}
                      aria-expanded={esta}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      {Icono && (
                        <span className="rounded-xl bg-[var(--color-fondo)] p-2.5 text-[var(--color-acento)]">
                          <Icono size={18} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-bold tabular-nums">
                            {fechaCorta(s.fecha)}
                          </span>
                          <span className="text-sm text-[var(--color-suave)]">
                            {NOMBRES_DIA[s.dia_key]}
                          </span>
                          <Etiqueta tono={s.estado === 'hecha' ? 'ok' : 'aviso'}>
                            {s.estado === 'hecha' ? 'Hecha' : 'Saltada'}
                          </Etiqueta>
                        </span>
                        <span className="mt-0.5 block text-sm text-[var(--color-suave)]">
                          {dia?.nombre ?? '—'} · Semana {s.semana}
                          {s.duracion_min ? ` · ${s.duracion_min} min` : ''}
                        </span>
                        {s.notas && (
                          <span className="mt-1 block text-sm italic">
                            «{s.notas}»
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => void eliminar(s)}
                      aria-label={`Borrar sesión del ${fechaCorta(s.fecha)}`}
                      className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {esta && series.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-[var(--color-borde)] pt-3">
                      {[...new Set(series.map((x) => x.ejercicio_slug))].map(
                        (slug) => {
                          const grupo = series.filter(
                            (x) => x.ejercicio_slug === slug,
                          )
                          return (
                            <div key={slug}>
                              <p className="text-sm font-semibold">
                                {grupo[0].ejercicio_nombre}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {grupo.map((x) => (
                                  <span
                                    key={x.id}
                                    className="rounded-lg bg-[var(--color-fondo)] px-2 py-1 text-xs font-semibold tabular-nums"
                                  >
                                    {resumirSerie(x)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )
                        },
                      )}
                    </div>
                  )}
                  {esta && series.length === 0 && (
                    <p className="mt-3 border-t border-[var(--color-borde)] pt-3 text-sm text-[var(--color-suave)]">
                      Sin series registradas en esta sesión.
                    </p>
                  )}
                </Tarjeta>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
