import {
  Bike,
  Cable,
  Dumbbell,
  Moon,
  Mountain,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Dia, DiaKey, TipoDia } from './tipos'

/**
 * Un icono distinto por sesión, acorde a lo que se hace ese día concreto:
 * nada de repetir el mismo símbolo genérico en toda la semana.
 */
const POR_DIA: Partial<Record<DiaKey, LucideIcon>> = {
  lunes: Dumbbell, // fuerza de empuje
  martes: Zap, // intervalos duros
  miercoles: Waves, // remo
  jueves: Bike, // rodaje tempo
  viernes: Cable, // fuerza de tirón
  sabado: Mountain, // salida larga
  domingo: Moon, // descanso
}

const POR_TIPO: Record<TipoDia, LucideIcon> = {
  gimnasio: Dumbbell,
  cardio: Bike,
  salida: Mountain,
  descanso: Moon,
}

export function iconoDeDia(dia: Pick<Dia, 'key' | 'tipo'>): LucideIcon {
  return POR_DIA[dia.key] ?? POR_TIPO[dia.tipo]
}
