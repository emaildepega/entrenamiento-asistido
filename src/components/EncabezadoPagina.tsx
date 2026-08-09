import type { ReactNode } from 'react'

/**
 * Encabezado estándar de todas las páginas: h1 text-3xl + subtítulo text-sm,
 * con mb-8. No usar otro formato en ninguna pantalla.
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  accion,
}: {
  titulo: string
  subtitulo?: string
  accion?: ReactNode
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl leading-tight font-bold">{titulo}</h1>
        {subtitulo && (
          <p className="mt-1 text-sm text-[var(--color-suave)]">{subtitulo}</p>
        )}
      </div>
      {accion}
    </header>
  )
}
