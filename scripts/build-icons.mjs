// Genera los iconos PNG de la PWA sin dependencias externas.
//   node scripts/build-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const FONDO = [15, 23, 42] // --color-fondo
const ACENTO = [249, 115, 22] // --color-acento

function crc32(buf) {
  let c
  const tabla = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = tabla[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** Silueta sencilla de mancuerna, centrada. */
function esMancuerna(x, y, lado) {
  const u = lado / 32
  const cx = lado / 2
  const cy = lado / 2
  const dx = Math.abs(x - cx)
  const dy = Math.abs(y - cy)
  const barra = dx <= 9 * u && dy <= 1.6 * u
  const discoInterior = dx >= 8 * u && dx <= 10.5 * u && dy <= 5 * u
  const discoExterior = dx >= 10.5 * u && dx <= 12.5 * u && dy <= 3.2 * u
  return barra || discoInterior || discoExterior
}

function png(lado) {
  const filas = []
  for (let y = 0; y < lado; y++) {
    const fila = Buffer.alloc(1 + lado * 3)
    fila[0] = 0 // filtro none
    for (let x = 0; x < lado; x++) {
      const color = esMancuerna(x, y, lado) ? ACENTO : FONDO
      fila[1 + x * 3] = color[0]
      fila[2 + x * 3] = color[1]
      fila[3 + x * 3] = color[2]
    }
    filas.push(fila)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 2 // color RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

for (const lado of [192, 512]) {
  writeFileSync(`public/icon-${lado}.png`, png(lado))
  console.log(`public/icon-${lado}.png`)
}
