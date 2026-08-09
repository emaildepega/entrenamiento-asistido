import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Boton, Campo, Cargando, Dialogo } from './ui'
import { AnimacionEjercicio } from './AnimacionEjercicio'
import {
  buscarEnCatalogo,
  cargarCatalogo,
  equipoEs,
  musculoEs,
} from '@/lib/catalogo'
import type { EntradaCatalogo } from '@/lib/tipos'

/**
 * Buscador sobre el catálogo de 873 ejercicios para asignar (o corregir) la
 * animación de un ejercicio del plan.
 */
export function SelectorAnimacion({
  abierto,
  onCerrar,
  nombreEjercicio,
  catalogoActual,
  onElegir,
}: {
  abierto: boolean
  onCerrar: () => void
  nombreEjercicio: string
  catalogoActual: string | null
  onElegir: (catalogoId: string | null) => void
}) {
  const [catalogo, setCatalogo] = useState<EntradaCatalogo[] | null>(null)
  const [consulta, setConsulta] = useState('')

  useEffect(() => {
    if (!abierto) return
    setConsulta('')
    cargarCatalogo().then(setCatalogo)
  }, [abierto])

  const resultados = useMemo(
    () => (catalogo ? buscarEnCatalogo(catalogo, consulta) : []),
    [catalogo, consulta],
  )

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Elegir animación"
      ancho="max-w-2xl"
    >
      <p className="mb-3 text-sm text-[var(--color-suave)]">
        Buscando animación para <strong>{nombreEjercicio}</strong>. El catálogo
        está en inglés: prueba con «bench press», «row», «curl»…
      </p>

      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-suave)]"
        />
        <Campo
          autoFocus
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Buscar por nombre, equipo o músculo…"
          className="pl-10"
        />
      </div>

      {!catalogo ? (
        <Cargando texto="Cargando catálogo…" />
      ) : resultados.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--color-suave)]">
          Nada con «{consulta}». Prueba con otra palabra, en inglés.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {resultados.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onElegir(e.id)
                onCerrar()
              }}
              className={`rounded-xl border p-2 text-left transition ${
                e.id === catalogoActual
                  ? 'border-[var(--color-acento)]'
                  : 'border-[var(--color-borde)] hover:border-[var(--color-acento)]'
              }`}
            >
              <AnimacionEjercicio
                catalogoId={e.id}
                nombre={e.n}
                ratio="aspect-square"
              />
              <p className="mt-2 line-clamp-2 text-xs font-semibold">{e.n}</p>
              <p className="text-[11px] text-[var(--color-suave)]">
                {equipoEs(e.eq)} · {musculoEs(e.m)}
              </p>
            </button>
          ))}
        </div>
      )}

      {catalogoActual && (
        <div className="mt-4 border-t border-[var(--color-borde)] pt-4">
          <Boton
            variante="fantasma"
            onClick={() => {
              onElegir(null)
              onCerrar()
            }}
          >
            Quitar la animación de este ejercicio
          </Boton>
        </div>
      )}
    </Dialogo>
  )
}
