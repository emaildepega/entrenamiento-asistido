import type { EntradaCatalogo } from './tipos'

const BASE_CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises'

/** Las dos fotos de un ejercicio: posición inicial y final. */
export function fotosDe(catalogoId: string): [string, string] {
  return [`${BASE_CDN}/${catalogoId}/0.jpg`, `${BASE_CDN}/${catalogoId}/1.jpg`]
}

let cache: EntradaCatalogo[] | null = null
let cargando: Promise<EntradaCatalogo[]> | null = null

export function cargarCatalogo(): Promise<EntradaCatalogo[]> {
  if (cache) return Promise.resolve(cache)
  if (cargando) return cargando
  cargando = fetch('/catalogo-ejercicios.json')
    .then((r) => {
      if (!r.ok) throw new Error('No se pudo cargar el catálogo de ejercicios')
      return r.json()
    })
    .then((datos: EntradaCatalogo[]) => {
      cache = datos
      return datos
    })
    .finally(() => {
      cargando = null
    })
  return cargando
}

export function catalogoEnMemoria(): EntradaCatalogo[] | null {
  return cache
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function buscarEnCatalogo(
  catalogo: EntradaCatalogo[],
  consulta: string,
  limite = 60,
): EntradaCatalogo[] {
  const q = normalizar(consulta).trim()
  if (!q) return catalogo.slice(0, limite)
  const partes = q.split(/\s+/)
  return catalogo
    .filter((e) => {
      const texto = normalizar(`${e.n} ${e.eq} ${e.m}`)
      return partes.every((p) => texto.includes(p))
    })
    .slice(0, limite)
}

/** Traducción de los nombres de equipo del catálogo, que vienen en inglés. */
export const EQUIPO_ES: Record<string, string> = {
  'body only': 'peso corporal',
  dumbbell: 'mancuernas',
  barbell: 'barra',
  bands: 'bandas',
  cable: 'polea',
  machine: 'máquina',
  kettlebells: 'kettlebell',
  'medicine ball': 'balón medicinal',
  'exercise ball': 'fitball',
  'e-z curl bar': 'barra Z',
  'foam roll': 'foam roller',
  other: 'otro',
}

export const MUSCULO_ES: Record<string, string> = {
  abdominals: 'abdomen',
  abductors: 'abductores',
  adductors: 'aductores',
  biceps: 'bíceps',
  calves: 'gemelos',
  chest: 'pecho',
  forearms: 'antebrazos',
  glutes: 'glúteos',
  hamstrings: 'isquios',
  lats: 'dorsales',
  'lower back': 'lumbar',
  'middle back': 'espalda media',
  neck: 'cuello',
  quadriceps: 'cuádriceps',
  shoulders: 'hombros',
  traps: 'trapecios',
  triceps: 'tríceps',
}

export function equipoEs(eq: string): string {
  return EQUIPO_ES[eq] ?? eq
}

export function musculoEs(m: string): string {
  return MUSCULO_ES[m] ?? m
}
