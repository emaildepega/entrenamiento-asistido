import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import { fotosDe } from '@/lib/catalogo'
import { cn } from '@/lib/utils'

type Estado = 'cargando' | 'lista' | 'error'

function prefiereMenosMovimiento() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Muestra la ejecución del ejercicio alternando las dos fotos del catálogo
 * (posición inicial y final). Si el usuario ha pedido menos movimiento, las
 * enseña una al lado de la otra en vez de animarlas.
 */
export function AnimacionEjercicio({
  catalogoId,
  nombre,
  className,
  ratio = 'aspect-[4/3]',
  onFalta,
}: {
  catalogoId: string | null
  nombre: string
  className?: string
  ratio?: string
  /** se llama al pulsar el hueco cuando no hay animación asignada */
  onFalta?: () => void
}) {
  const fotos = useMemo(
    () => (catalogoId ? fotosDe(catalogoId) : null),
    [catalogoId],
  )
  const [estado, setEstado] = useState<Estado>('cargando')
  const [frame, setFrame] = useState(0)
  const estatico = useRef(prefiereMenosMovimiento())

  useEffect(() => {
    if (!fotos) return
    let vivo = true
    setEstado('cargando')

    Promise.all(
      fotos.map(
        (src) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve()
            img.onerror = () => reject(new Error(src))
            img.src = src
          }),
      ),
    )
      .then(() => vivo && setEstado('lista'))
      .catch(() => vivo && setEstado('error'))

    return () => {
      vivo = false
    }
  }, [fotos])

  useEffect(() => {
    if (estado !== 'lista' || estatico.current) return
    const t = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 900)
    return () => clearInterval(t)
  }, [estado])

  // Sin animación asignada, o las fotos no cargan
  if (!fotos || estado === 'error') {
    const contenido = (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--color-suave)]">
        <ImageOff size={26} />
        <span className="px-4 text-center text-xs font-semibold">
          {estado === 'error' ? 'No se pudo cargar' : 'Sin animación'}
        </span>
        {onFalta && (
          <span className="text-xs underline">Buscar animación</span>
        )}
      </div>
    )
    return onFalta ? (
      <button
        type="button"
        onClick={onFalta}
        aria-label={`Asignar animación a ${nombre}`}
        className={cn(
          ratio,
          'w-full overflow-hidden rounded-xl border border-dashed border-[var(--color-borde)] bg-[var(--color-fondo)]',
          className,
        )}
      >
        {contenido}
      </button>
    ) : (
      <div
        className={cn(
          ratio,
          'w-full overflow-hidden rounded-xl border border-dashed border-[var(--color-borde)] bg-[var(--color-fondo)]',
          className,
        )}
      >
        {contenido}
      </div>
    )
  }

  // Menos movimiento: las dos fotos en fila, sin animar
  if (estatico.current) {
    return (
      <div className={cn('grid w-full grid-cols-2 gap-2', className)}>
        {fotos.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`${nombre} — posición ${i === 0 ? 'inicial' : 'final'}`}
            className={cn(ratio, 'w-full rounded-xl object-cover')}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        ratio,
        'relative w-full overflow-hidden rounded-xl bg-[var(--color-fondo)]',
        className,
      )}
    >
      {fotos.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? `Ejecución de ${nombre}` : ''}
          aria-hidden={i === 1}
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-250',
            frame === i ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}
      {estado === 'cargando' && (
        <div className="absolute inset-0 animate-pulse bg-[var(--color-borde)]" />
      )}
    </div>
  )
}
