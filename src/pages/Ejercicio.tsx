import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Settings2, CirclePlay } from 'lucide-react'
import { EncabezadoPagina } from '@/components/EncabezadoPagina'
import { AnimacionEjercicio } from '@/components/AnimacionEjercicio'
import { SelectorAnimacion } from '@/components/SelectorAnimacion'
import { Boton, Cargando, Tarjeta } from '@/components/ui'
import { usePlanActivo } from '@/hooks/usePlan'
import {
  guardarMedia,
  historico,
  mediaDe,
  resumirSerie,
  type RegistroPasado,
} from '@/lib/datos'
import { fechaCorta } from '@/lib/utils'
import type { Ejercicio as TipoEjercicio } from '@/lib/tipos'

export default function Ejercicio() {
  const { slug = '' } = useParams()
  const { plan, cargando } = usePlanActivo()
  const [registros, setRegistros] = useState<RegistroPasado[]>([])
  const [catalogoId, setCatalogoId] = useState<string | null>(null)
  const [selectorAbierto, setSelectorAbierto] = useState(false)
  const [listo, setListo] = useState(false)

  const ejercicio: TipoEjercicio | null = useMemo(() => {
    if (!plan) return null
    for (const d of plan.estructura.dias) {
      const e = d.ejercicios.find((x) => x.slug === slug)
      if (e) return e
    }
    return null
  }, [plan, slug])

  useEffect(() => {
    let vivo = true
    void Promise.all([historico(slug, 10), mediaDe(slug)]).then(
      ([hist, media]) => {
        if (!vivo) return
        setRegistros(hist)
        setCatalogoId(media ? media.catalogo_id : null)
        setListo(true)
      },
    )
    return () => {
      vivo = false
    }
  }, [slug])

  if (cargando || !listo) return <Cargando />

  const nombre = ejercicio?.nombre ?? registros[0]?.series[0]?.ejercicio_nombre ?? slug
  const idAnimacion = catalogoId ?? ejercicio?.catalogo_id ?? null

  return (
    <>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-suave)]"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <EncabezadoPagina
        titulo={nombre}
        subtitulo={
          registros.length > 0
            ? `${registros.length} ${registros.length === 1 ? 'sesión registrada' : 'sesiones registradas'}`
            : 'Todavía sin registros'
        }
      />

      <AnimacionEjercicio
        catalogoId={idAnimacion}
        nombre={nombre}
        ratio="aspect-[16/10]"
        onFalta={() => setSelectorAbierto(true)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={() => setSelectorAbierto(true)}>
          <Settings2 size={18} />
          Cambiar animación
        </Boton>
        {ejercicio?.youtube_id && (
          <a
            href={`https://www.youtube.com/watch?v=${ejercicio.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Boton variante="secundario">
              <CirclePlay size={18} />
              Ver vídeo
            </Boton>
          </a>
        )}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-bold text-[var(--color-suave)] uppercase">
        Histórico
      </h2>

      {registros.length === 0 ? (
        <Tarjeta className="text-center text-sm text-[var(--color-suave)]">
          Aún no has registrado series de este ejercicio.
        </Tarjeta>
      ) : (
        <div className="space-y-3">
          {registros.map((r) => (
            <Tarjeta key={r.fecha}>
              <p className="mb-2 text-sm font-bold tabular-nums">
                {fechaCorta(r.fecha)}
              </p>
              <div className="flex flex-wrap gap-2">
                {r.series.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg bg-[var(--color-fondo)] px-2.5 py-1.5 text-sm font-semibold tabular-nums"
                  >
                    {resumirSerie(s)}
                  </span>
                ))}
              </div>
            </Tarjeta>
          ))}
        </div>
      )}

      <SelectorAnimacion
        abierto={selectorAbierto}
        onCerrar={() => setSelectorAbierto(false)}
        nombreEjercicio={nombre}
        catalogoActual={idAnimacion}
        onElegir={async (id) => {
          await guardarMedia({
            ejercicio_slug: slug,
            catalogo_id: id,
            youtube_id: ejercicio?.youtube_id ?? null,
          })
          setCatalogoId(id)
        }}
      />
    </>
  )
}
