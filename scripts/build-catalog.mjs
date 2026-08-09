// Descarga el catálogo público de ejercicios (free-exercise-db, dominio público)
// y genera una versión reducida para el navegador.
//   node scripts/build-catalog.mjs
import { writeFileSync, mkdirSync } from 'node:fs'

const ORIGEN =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const DESTINO = 'public/catalogo-ejercicios.json'

const res = await fetch(ORIGEN)
if (!res.ok) throw new Error(`No se pudo descargar el catálogo: ${res.status}`)
const todos = await res.json()

// Solo los que tienen las dos fotos (posición inicial y final): son los que
// podemos animar. Nos quedamos con lo mínimo para buscar y mostrar.
const reducido = todos
  .filter((e) => Array.isArray(e.images) && e.images.length >= 2)
  .map((e) => ({
    id: e.id,
    n: e.name,
    eq: e.equipment || 'other',
    m: e.primaryMuscles?.[0] || 'other',
  }))

mkdirSync('public', { recursive: true })
writeFileSync(DESTINO, JSON.stringify(reducido))

const kb = Math.round(JSON.stringify(reducido).length / 1024)
console.log(`${reducido.length} ejercicios → ${DESTINO} (${kb} KB)`)
