import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Flame,
  Settings,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PESTANAS = [
  { a: '/', etiqueta: 'Hoy', Icono: Flame },
  { a: '/semana', etiqueta: 'Semana', Icono: CalendarDays },
  { a: '/progreso', etiqueta: 'Progreso', Icono: TrendingUp },
  { a: '/planes', etiqueta: 'Planes', Icono: ClipboardList },
  { a: '/ajustes', etiqueta: 'Ajustes', Icono: Settings },
]

export function NavInferior() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-borde)] bg-[var(--color-tarjeta)]/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {PESTANAS.map(({ a, etiqueta, Icono }) => (
          <li key={a} className="flex-1">
            <NavLink
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold transition',
                  isActive
                    ? 'text-[var(--color-acento)]'
                    : 'text-[var(--color-suave)]',
                )
              }
            >
              <Icono size={20} />
              {etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
