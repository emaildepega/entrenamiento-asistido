import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, Cargando, Dialogo, Tarjeta } from './ui'
import { AnimacionEjercicio } from './AnimacionEjercicio'
import {
  buscarEjercicios,
  ejercicioNuevo,
  ejerciciosConocidos,
} from '@/lib/ejercicios'
import {
  buscarEnCatalogo,
  cargarCatalogo,
  equipoEs,
  musculoEs,
} from '@/lib/catalogo'
import { hayNube } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Ejercicio, EntradaCatalogo } from '@/lib/tipos'

type Pestana = 'usados' | 'catalogo' | 'nuevo'

/**
 * Elegir un ejercicio de tres maneras: de los que ya has usado en algún plan,
 * buscándolo en el catálogo de animaciones, o escribiendo uno nuevo y dejando
 * que la IA le busque animación y vídeo.
 */
export function SelectorEjercicio({
  abierto,
  onCerrar,
  onElegir,
}: {
  abierto: boolean
  onCerrar: () => void
  onElegir: (ejercicio: Ejercicio) => void
}) {
  const [pestana, setPestana] = useState<Pestana>('usados')
  const [conocidos, setConocidos] = useState<Ejercicio[]>([])
  const [catalogo, setCatalogo] = useState<EntradaCatalogo[] | null>(null)
  const [consulta, setConsulta] = useState('')
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setConsulta('')
    setNombreNuevo('')
    void ejerciciosConocidos().then((e) => {
      setConocidos(e)
      setPestana(e.length > 0 ? 'usados' : 'nuevo')
    })
  }, [abierto])

  useEffect(() => {
    if (pestana === 'catalogo' && !catalogo) void cargarCatalogo().then(setCatalogo)
  }, [pestana, catalogo])

  const usadosFiltrados = useMemo(
    () =>
      conocidos.filter((e) =>
        e.nombre.toLowerCase().includes(consulta.toLowerCase()),
      ),
    [conocidos, consulta],
  )

  const resultadosCatalogo = useMemo(
    () => (catalogo ? buscarEnCatalogo(catalogo, consulta, 40) : []),
    [catalogo, consulta],
  )

  const crearConIA = async () => {
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    setBuscando(true)
    try {
      const [hallado] = await buscarEjercicios([nombre])
      const ej = ejercicioNuevo(
        nombre,
        hallado?.catalogo_id ?? null,
        hallado?.youtube_id ?? null,
        hallado?.medicion,
      )
      onElegir(ej)
      const encontrado = [
        ej.catalogo_id ? 'animación' : null,
        ej.youtube_id ? 'vídeo' : null,
      ].filter(Boolean)
      toast.success(
        encontrado.length === 2
          ? 'Añadido con animación y vídeo'
          : encontrado.length === 1
            ? `Añadido con ${encontrado[0]}; lo otro puedes ponerlo a mano`
            : 'Añadido, pero sin animación ni vídeo: puedes ponerlos a mano',
      )
      onCerrar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido buscar')
    } finally {
      setBuscando(false)
    }
  }

  const PESTANAS: { id: Pestana; etiqueta: string }[] = [
    { id: 'usados', etiqueta: `Ya usados (${conocidos.length})` },
    { id: 'catalogo', etiqueta: 'Catálogo' },
    { id: 'nuevo', etiqueta: 'Nuevo' },
  ]

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Añadir ejercicio"
      ancho="max-w-2xl"
    >
      <div className="mb-4 flex gap-1 rounded-xl bg-[var(--color-fondo)] p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPestana(p.id)}
            className={cn(
              'min-h-10 flex-1 rounded-lg px-2 text-sm font-bold transition',
              pestana === p.id
                ? 'bg-[var(--color-acento)] text-white'
                : 'text-[var(--color-suave)]',
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {/* --------------------------------------------------- ya usados */}
      {pestana === 'usados' && (
        <>
          {conocidos.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-suave)]">
              Todavía no has usado ningún ejercicio. Crea uno nuevo o búscalo en
              el catálogo.
            </p>
          ) : (
            <>
              <Campo
                autoFocus
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Filtrar por nombre…"
                className="mb-3"
              />
              <ul className="grid gap-2 sm:grid-cols-2">
                {usadosFiltrados.map((e) => (
                  <li key={e.slug}>
                    <button
                      onClick={() => {
                        onElegir(e)
                        onCerrar()
                      }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-borde)] p-2 text-left hover:border-[var(--color-acento)]"
                    >
                      <div className="w-16 shrink-0">
                        <AnimacionEjercicio
                          catalogoId={e.catalogo_id}
                          nombre={e.nombre}
                          ratio="aspect-square"
                        />
                      </div>
                      <span className="text-sm font-semibold">{e.nombre}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {/* ---------------------------------------------------- catálogo */}
      {pestana === 'catalogo' && (
        <>
          <div className="relative mb-3">
            <Search
              size={18}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-suave)]"
            />
            <Campo
              autoFocus
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar en inglés: bench press, row, curl…"
              className="pl-10"
            />
          </div>
          {!catalogo ? (
            <Cargando texto="Cargando catálogo…" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {resultadosCatalogo.map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    onElegir(ejercicioNuevo(e.n, e.id))
                    onCerrar()
                  }}
                  className="rounded-xl border border-[var(--color-borde)] p-2 text-left hover:border-[var(--color-acento)]"
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
        </>
      )}

      {/* ------------------------------------------------------- nuevo */}
      {pestana === 'nuevo' && (
        <Tarjeta>
          <label
            htmlFor="nuevo-ejercicio"
            className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
          >
            Nombre del ejercicio
          </label>
          <Campo
            id="nuevo-ejercicio"
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hayNube) void crearConIA()
            }}
            placeholder="Sentadilla búlgara con mancuernas"
          />
          <p className="mt-2 text-sm text-[var(--color-suave)]">
            {hayNube
              ? 'La IA le buscará la animación y un vídeo de demostración, y comprobará que existen antes de añadirlos.'
              : 'Sin cuenta configurada no se puede buscar automáticamente: añádelo y asígnale la animación desde el catálogo.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {hayNube && (
              <Boton
                onClick={() => void crearConIA()}
                disabled={!nombreNuevo.trim() || buscando}
              >
                <Sparkles size={18} />
                {buscando ? 'Buscando…' : 'Añadir y buscar'}
              </Boton>
            )}
            <Boton
              variante="secundario"
              disabled={!nombreNuevo.trim() || buscando}
              onClick={() => {
                onElegir(ejercicioNuevo(nombreNuevo))
                onCerrar()
              }}
            >
              Añadir sin buscar
            </Boton>
          </div>
        </Tarjeta>
      )}
    </Dialogo>
  )
}
