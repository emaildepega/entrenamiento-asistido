import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
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

/** Navegación de escritorio. En móvil se usa NavInferior. */
export function NavLateral() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[var(--color-borde)] bg-[var(--color-tarjeta)] p-4 md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span className="rounded-xl bg-[var(--color-acento)] p-2 text-white">
          <Dumbbell size={20} />
        </span>
        <span className="text-[15px] leading-tight font-black">
          Entrenamiento
          <br />
          Asistido
        </span>
      </div>

      <nav>
        <ul className="space-y-1">
          {PESTANAS.map(({ a, etiqueta, Icono }) => (
            <li key={a}>
              <NavLink
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition',
                    isActive
                      ? 'bg-[var(--color-acento)]/15 text-[var(--color-acento)]'
                      : 'text-[var(--color-suave)] hover:bg-[var(--color-fondo)] hover:text-[var(--color-texto)]',
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
    </aside>
  )
}
