import { addDays, format, nextMonday, isMonday } from 'date-fns'
import type { Estructura, Medicion, Plan } from './tipos'
import { slugificar } from './plan'

type EjercicioSemilla = [
  nombre: string,
  catalogoId: string | null,
  youtubeId: string | null,
  prescripcion?: Record<string, string>,
  medicion?: Medicion,
]

function ej(...args: EjercicioSemilla) {
  const [nombre, catalogo_id, youtube_id, prescripcion, medicion] = args
  return {
    slug: slugificar(nombre),
    nombre,
    catalogo_id,
    youtube_id,
    ...(prescripcion ? { prescripcion } : {}),
    ...(medicion ? { medicion } : {}),
  }
}

export const ESTRUCTURA_SEMILLA: Estructura = {
  semanas: 4,
  nombres_semana: ['Adaptación', 'Carga', 'Pico', 'Descarga'],
  avisos: [
    'Martes duro, jueves moderado. Nunca los dos a tope.',
    'Come de más jueves y viernes. El sábado se paga lo que no comiste antes.',
    'Progresa primero en repeticiones, y cuando llegues arriba del rango, sube peso y vuelve abajo.',
    'Si llegas al jueves destrozado, cambia el rodaje por 45 min suaves sin remordimiento. El plan sirve a la temporada, no al revés.',
    'El declinado exige lumbar. Si notas molestia, baja la inclinación y prioriza plancha y elevación de piernas.',
    'Con 8–10 h de bici semanales, mantener fuerza ya es ganar. El pico de fuerza real hazlo en invierno.',
  ],
  dias: [
    {
      key: 'lunes',
      nombre: 'Fuerza A – empuje + core',
      tipo: 'gimnasio',
      hora_inicio: '06:00',
      hora_fin: '07:00',
      enfoque: 'Exigente (vienes de descanso)',
      calentamiento: 'Remo suave 5 min',
      prescripcion: {
        '1': '3×10 por ejercicio, peso cómodo (2–3 reps de margen)',
        '2': '3×10–12, sube peso donde fue fácil',
        '3': '4 series en presses, 8–10 reps con más peso',
        '4': '2 series, peso de S1, sin fallar',
      },
      ejercicios: [
        ej('Press banca plano con mancuernas', 'Dumbbell_Bench_Press', 'ZaDlbm8E8Tg'),
        ej('Press inclinado (respaldo 30–45°)', 'Incline_Dumbbell_Press', 'oZVCBM9f8Eo'),
        ej('Press militar sentado', 'Seated_Dumbbell_Press', 'poD_-zaG9hk'),
        ej('Extensión de tríceps tumbado', 'Lying_Triceps_Press', 'R6SdxvZGK5s'),
        ej(
          'Crunch en declinado (pies anclados)',
          'Decline_Crunch',
          'FRzQXeN1hro',
          undefined,
          'reps',
        ),
        ej(
          'Plancha frontal',
          'Plank',
          'gfj5MWBNxxU',
          {
            '1': '3×30 s',
            '2': '3×40 s',
            '3': '3×45 s',
            '4': '2×30 s',
          },
          'tiempo',
        ),
      ],
    },
    {
      key: 'martes',
      nombre: 'Bici – intervalos',
      tipo: 'cardio',
      hora_inicio: '06:00',
      hora_fin: '08:00',
      enfoque: 'Día duro',
      prescripcion: {
        '1': '90 min · 5×4 min fuertes (rec. 3 min)',
        '2': '100–110 min · 4×8 min a ritmo alto',
        '3': '120 min · 6×4 min o series de puerto',
        '4': '90 min suave, sin intervalos',
      },
      intervalos: {
        '1': { series: 5, trabajo_min: 4, descanso_min: 3 },
        '2': { series: 4, trabajo_min: 8, descanso_min: 4 },
        '3': { series: 6, trabajo_min: 4, descanso_min: 3 },
        '4': null,
      },
      ejercicios: [],
    },
    {
      key: 'miercoles',
      nombre: 'Remo + core',
      tipo: 'gimnasio',
      hora_inicio: '06:00',
      hora_fin: '07:00',
      enfoque: 'Recuperación activa · suave',
      aviso:
        'Día suave, es sagrado. Está entre la fuerza del lunes y la bici del jueves. Si lo conviertes en paliza, el resto de la semana se derrumba.',
      prescripcion: {
        '1': 'Remo 20 min suave + core 3 series',
        '2': 'Remo 4×6 min moderado + core',
        '3': 'Remo 25 min MUY suave + core ligero',
        '4': 'Remo 15 min + estiramientos',
      },
      ejercicios: [
        ej('Remo en máquina', 'Rowing_Stationary', '4zWu1yuJ0_g', {
          '1': '20 min suave',
          '2': '4×6 min moderado',
          '3': '25 min MUY suave',
          '4': '15 min + estiramientos',
        }, 'tiempo'),
        ej('Elevación de piernas en declinado', 'Flat_Bench_Lying_Leg_Raise', 'b_6BdouMVc0', {
          '1': '3×12',
          '2': '3×12',
          '3': '2×12 ligero',
          '4': 'Solo estiramientos',
        }, 'reps'),
        ej('Russian twist con mancuerna', 'Russian_Twist', 'qYym5L-B9hs', {
          '1': '3×20',
          '2': '3×20',
          '3': '2×20 ligero',
          '4': 'Solo estiramientos',
        }, 'reps_peso'),
        ej('Plancha lateral', 'Side_Bridge', 'N_s9em1xTqU', {
          '1': '3×30 s por lado',
          '2': '3×30 s por lado',
          '3': '2×30 s por lado',
          '4': 'Solo estiramientos',
        }, 'tiempo'),
        ej('Superman en el suelo', 'Superman', 'UXUGfiNL1lI', {
          '1': '3×12',
          '2': '3×12',
          '3': '2×12 ligero',
          '4': 'Solo estiramientos',
        }, 'reps'),
      ],
    },
    {
      key: 'jueves',
      nombre: 'Bici – tempo/resistencia',
      tipo: 'cardio',
      hora_inicio: '06:00',
      hora_fin: '08:00',
      enfoque: 'Moderado',
      prescripcion: {
        '1': '90 min · 2×15 min tempo',
        '2': '100 min · 3×12 min tempo',
        '3': '120 min · 2×20 min tempo',
        '4': '60–75 min suave',
      },
      intervalos: {
        '1': { series: 2, trabajo_min: 15, descanso_min: 5 },
        '2': { series: 3, trabajo_min: 12, descanso_min: 5 },
        '3': { series: 2, trabajo_min: 20, descanso_min: 5 },
        '4': null,
      },
      ejercicios: [],
    },
    {
      key: 'viernes',
      nombre: 'Fuerza B – tirón + core',
      tipo: 'gimnasio',
      hora_inicio: '06:00',
      hora_fin: '07:00',
      enfoque: 'Contenida (mañana salida larga)',
      aviso:
        'Contenida, no es negociable. Una sesión de tirón dura más 5 h de sábado es receta para lumbares castigadas y una salida mediocre.',
      calentamiento: 'Remo suave 5 min',
      prescripcion: {
        '1': '3×10 dejando 3 reps de margen',
        '2': 'Igual que S1, contenido',
        '3': '2–3 series por ejercicio, ligero',
        '4': 'Solo core, 20 min',
      },
      ejercicios: [
        ej('Remo a una mano apoyado en el banco', 'One-Arm_Dumbbell_Row', 'PgpQ4-jHiq4'),
        ej('Pullover con mancuerna', 'Straight-Arm_Dumbbell_Pullover', 'tcHaHIQStsk'),
        ej('Face pull con banda elástica', 'Face_Pull', 'PYj77in44ms', undefined, 'reps'),
        ej('Curl de bíceps sentado', 'Seated_Dumbbell_Curl', 'O0ffoQlgCwA'),
        ej('Pallof press con banda (antirrotación)', 'Pallof_Press', 'P16SQlmWj1o', undefined, 'reps'),
      ],
    },
    {
      key: 'sabado',
      nombre: 'Salida larga',
      tipo: 'salida',
      hora_inicio: '07:00',
      hora_fin: '12:00',
      enfoque: 'Sesión clave de la semana',
      prescripcion: {
        '1': '4 h a ritmo de resistencia',
        '2': '4,5 h · últimos 45 min más vivos',
        '3': '5 h — salida grande del bloque',
        '4': '3 h tranquilas',
      },
      ejercicios: [],
    },
    {
      key: 'domingo',
      nombre: 'Descanso',
      tipo: 'descanso',
      enfoque: 'Total',
      prescripcion: { '1': '', '2': '', '3': '', '4': '' },
      ejercicios: [],
    },
  ],
}

/** Plan inicial que se crea la primera vez que se abre la app. */
export function crearPlanSemilla(hoy = new Date()): Plan {
  const inicio = isMonday(hoy) ? hoy : nextMonday(hoy)
  return {
    id: crypto.randomUUID(),
    nombre: 'Bici + fuerza + remo',
    descripcion: 'Bloque de 4 semanas · 6 días/semana, descanso los domingos',
    semanas: 4,
    fecha_inicio: format(inicio, 'yyyy-MM-dd'),
    activo: true,
    estructura: ESTRUCTURA_SEMILLA,
    created_at: new Date().toISOString(),
  }
}

/** Fecha sugerida para arrancar el bloque siguiente. */
export function siguienteLunes(desde = new Date()): Date {
  return isMonday(desde) ? addDays(desde, 7) : nextMonday(desde)
}
