import { ajustesLocales } from './ajustes'
import { vibrar } from './utils'

/**
 * Aviso de fin de temporizador: pitidos generados con Web Audio (nada de
 * archivos que descargar) y vibración.
 *
 * En el móvil el navegador solo deja sonar si el contexto de audio nació de un
 * gesto del usuario, así que se crea con el primer toque en la app
 * (`desbloquearAudio`) y luego se reutiliza siempre el mismo.
 */

type ConstructorAudio = typeof AudioContext

let ctx: AudioContext | null = null
let sonando = false
let pendientes: number[] = []

function contexto(): AudioContext | null {
  if (ctx) return ctx
  const Constructor: ConstructorAudio | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: ConstructorAudio })
      .webkitAudioContext
  if (!Constructor) return null
  try {
    ctx = new Constructor()
  } catch {
    return null
  }
  return ctx
}

/**
 * Se llama con el primer toque en la app. Sin esto, cuando llega el momento de
 * avisar el navegador ignora la orden y el temporizador acaba en silencio.
 */
export function desbloquearAudio() {
  const c = contexto()
  if (!c) return
  void c.resume()
  // Algunos navegadores no dan el contexto por desbloqueado hasta que ha
  // reproducido algo, aunque sea un pulso mudo.
  try {
    const osc = c.createOscillator()
    const gan = c.createGain()
    gan.gain.value = 0
    osc.connect(gan).connect(c.destination)
    osc.start()
    osc.stop(c.currentTime + 0.01)
  } catch {
    /* si falla, se reintentará en el siguiente toque */
  }
}

function pitido(c: AudioContext, cuando: number, hz: number, duracion: number) {
  const osc = c.createOscillator()
  const gan = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(hz, cuando)
  gan.gain.setValueAtTime(0.0001, cuando)
  gan.gain.exponentialRampToValueAtTime(0.3, cuando + 0.015)
  gan.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion)
  osc.connect(gan).connect(c.destination)
  osc.start(cuando)
  osc.stop(cuando + duracion + 0.03)
}

/** Tres pitidos: dos cortos y uno largo. */
function ronda() {
  const c = contexto()
  if (!c) return
  void c.resume()
  try {
    const t = c.currentTime + 0.03
    pitido(c, t, 880, 0.16)
    pitido(c, t + 0.26, 880, 0.16)
    pitido(c, t + 0.52, 1175, 0.34)
  } catch {
    /* el navegador puede negarse si no hubo gesto previo */
  }
}

const RONDAS = 4
const PAUSA_MS = 1500

/**
 * Alarma de verdad: insiste unos segundos, para que se oiga aunque el móvil
 * esté en el suelo al lado del banco. Se corta con `pararAlarma`.
 */
export function sonarAlarma() {
  const { sonido, vibracion } = ajustesLocales()
  if (!sonido && !vibracion) return
  pararAlarma()
  sonando = true

  const disparar = (n: number) => {
    if (!sonando) return
    if (vibracion) vibrar([450, 150, 450, 150, 700])
    if (sonido) ronda()
    if (n + 1 < RONDAS) {
      pendientes.push(window.setTimeout(() => disparar(n + 1), PAUSA_MS))
    } else {
      sonando = false
    }
  }
  disparar(0)
}

export function pararAlarma() {
  sonando = false
  for (const t of pendientes) window.clearTimeout(t)
  pendientes = []
  vibrar(0)
}

/** Aviso breve para cambios de fase y confirmaciones. */
export function pitidoCorto(agudo = false) {
  const { sonido, vibracion } = ajustesLocales()
  if (vibracion) vibrar(agudo ? [220, 90, 220] : 90)
  if (!sonido) return
  const c = contexto()
  if (!c) return
  void c.resume()
  try {
    pitido(c, c.currentTime + 0.02, agudo ? 1175 : 660, 0.18)
  } catch {
    /* ignorado */
  }
}
