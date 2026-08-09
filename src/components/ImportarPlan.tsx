import { useRef, useState } from 'react'
import { AlertTriangle, FileUp, Settings2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { AreaTexto, Boton, Campo, Dialogo, Etiqueta, Tarjeta } from './ui'
import { AnimacionEjercicio } from './AnimacionEjercicio'
import { SelectorAnimacion } from './SelectorAnimacion'
import { SelectorFecha } from './SelectorFecha'
import { leerPlanPdf, type PlanLeido } from '@/lib/importar'
import { guardarPlan, activarPlan } from '@/lib/datos'
import { aISO } from '@/lib/plan'
import { siguienteLunes } from '@/lib/seed'
import { NOMBRES_DIA, type Estructura, type Plan } from '@/lib/tipos'

type Paso = 'subir' | 'analizando' | 'revisar'

const MENSAJES = [
  'Leyendo el PDF…',
  'Identificando las sesiones…',
  'Repartiendo la progresión por semanas…',
  'Buscando las animaciones…',
]

export function ImportarPlan({
  abierto,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [paso, setPaso] = useState<Paso>('subir')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [mensaje, setMensaje] = useState(0)
  const [leido, setLeido] = useState<PlanLeido | null>(null)
  const [inicio, setInicio] = useState(() => siguienteLunes())
  const [editando, setEditando] = useState<{ dia: number; ej: number } | null>(
    null,
  )
  const [arrastrando, setArrastrando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const reiniciar = () => {
    setPaso('subir')
    setArchivo(null)
    setLeido(null)
    setMensaje(0)
  }

  const cerrar = () => {
    reiniciar()
    onCerrar()
  }

  const analizar = async (f: File) => {
    setPaso('analizando')
    const rotar = setInterval(
      () => setMensaje((m) => (m + 1) % MENSAJES.length),
      6000,
    )
    try {
      const resultado = await leerPlanPdf(f)
      setLeido(resultado)
      setPaso('revisar')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se ha podido leer el PDF')
      setPaso('subir')
    } finally {
      clearInterval(rotar)
    }
  }

  const elegirArchivo = (f: File | undefined) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      toast.error('Tiene que ser un PDF')
      return
    }
    setArchivo(f)
  }

  const cambiarEstructura = (nueva: Estructura) =>
    setLeido((l) => (l ? { ...l, estructura: nueva } : l))

  const guardar = async (activar: boolean) => {
    if (!leido) return
    const plan: Plan = {
      id: crypto.randomUUID(),
      nombre: leido.nombre,
      descripcion: leido.descripcion,
      semanas: leido.semanas,
      fecha_inicio: aISO(inicio),
      activo: activar,
      estructura: leido.estructura,
      created_at: new Date().toISOString(),
    }
    await guardarPlan(plan)
    if (activar) await activarPlan(plan.id)
    toast.success(activar ? `«${plan.nombre}» activado` : 'Plan guardado')
    onGuardado()
    cerrar()
  }

  /* ---------------------------------------------------------------- pasos */

  const contenido = () => {
    if (paso === 'subir') {
      return (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault()
              setArrastrando(false)
              elegirArchivo(e.dataTransfer.files?.[0])
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
              arrastrando
                ? 'border-[var(--color-acento)] bg-[var(--color-acento)]/10'
                : 'border-[var(--color-borde)]'
            }`}
          >
            <FileUp
              className="mx-auto mb-3 text-[var(--color-suave)]"
              size={32}
            />
            <p className="font-semibold">Arrastra aquí tu plan en PDF</p>
            <p className="mt-1 text-sm text-[var(--color-suave)]">
              o elígelo desde el ordenador
            </p>
            <Boton
              variante="secundario"
              className="mt-4"
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={18} />
              Elegir archivo
            </Boton>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                elegirArchivo(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>

          {archivo && (
            <Tarjeta className="mt-4">
              <p className="text-sm font-semibold break-all">{archivo.name}</p>
              <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                {Math.round(archivo.size / 1024)} KB
              </p>
              <Boton className="mt-3 w-full" onClick={() => void analizar(archivo)}>
                Analizar
              </Boton>
            </Tarjeta>
          )}
        </>
      )
    }

    if (paso === 'analizando') {
      return (
        <div className="py-12 text-center">
          <div className="mx-auto mb-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-[var(--color-borde)]">
            <div className="h-full w-1/3 animate-[indeterminado_1.4s_ease-in-out_infinite] rounded-full bg-[var(--color-acento)]" />
          </div>
          <p className="font-semibold">{MENSAJES[mensaje]}</p>
          <p className="mt-2 text-sm text-[var(--color-suave)]">
            Puede tardar entre medio minuto y minuto y medio. No cierres esta
            ventana.
          </p>
          <style>{`@keyframes indeterminado{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )
    }

    if (!leido) return null

    return (
      <div className="space-y-4">
        {leido.sinAnimacion.length > 0 && (
          <Tarjeta className="flex gap-3 border-amber-500/40 bg-amber-500/10">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="text-sm">
              <p className="font-bold">
                {leido.sinAnimacion.length}{' '}
                {leido.sinAnimacion.length === 1
                  ? 'ejercicio sin animación'
                  : 'ejercicios sin animación'}
              </p>
              <p className="mt-1 text-[var(--color-suave)]">
                Puedes asignarlas ahora con el engranaje, o dejarlo y hacerlo
                más tarde desde la sesión. Se guarda igual.
              </p>
            </div>
          </Tarjeta>
        )}

        <Tarjeta className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
              Nombre del plan
            </label>
            <Campo
              value={leido.nombre}
              onChange={(e) => setLeido({ ...leido, nombre: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
              Descripción
            </label>
            <AreaTexto
              rows={2}
              value={leido.descripcion}
              onChange={(e) =>
                setLeido({ ...leido, descripcion: e.target.value })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
                Semanas del bloque
              </label>
              <Campo
                type="number"
                inputMode="numeric"
                min={1}
                value={leido.semanas}
                onChange={(e) =>
                  setLeido({ ...leido, semanas: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase">
                El bloque empieza
              </label>
              <SelectorFecha
                valor={inicio}
                onCambiar={setInicio}
                etiqueta="Inicio del bloque"
              />
            </div>
          </div>
        </Tarjeta>

        {leido.estructura.dias.map((dia, di) => (
          <Tarjeta key={`${dia.key}-${di}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-bold">{NOMBRES_DIA[dia.key] ?? dia.key}</span>
              <Etiqueta tono={dia.tipo === 'descanso' ? 'neutro' : 'acento'}>
                {dia.tipo}
              </Etiqueta>
            </div>
            <Campo
              value={dia.nombre}
              onChange={(e) => {
                const dias = [...leido.estructura.dias]
                dias[di] = { ...dia, nombre: e.target.value }
                cambiarEstructura({ ...leido.estructura, dias })
              }}
              className="mb-3"
            />

            {Object.keys(dia.prescripcion ?? {}).length > 0 && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {Array.from({ length: leido.semanas }, (_, i) => String(i + 1)).map(
                  (sem) => (
                    <div key={sem}>
                      <label className="mb-1 block text-[11px] font-bold text-[var(--color-suave)] uppercase">
                        Semana {sem}
                      </label>
                      <Campo
                        value={dia.prescripcion?.[sem] ?? ''}
                        onChange={(e) => {
                          const dias = [...leido.estructura.dias]
                          dias[di] = {
                            ...dia,
                            prescripcion: {
                              ...dia.prescripcion,
                              [sem]: e.target.value,
                            },
                          }
                          cambiarEstructura({ ...leido.estructura, dias })
                        }}
                        className="min-h-11 text-sm"
                      />
                    </div>
                  ),
                )}
              </div>
            )}

            {dia.ejercicios.length > 0 && (
              <ul className="space-y-2">
                {dia.ejercicios.map((ej, ei) => (
                  <li
                    key={`${ej.slug}-${ei}`}
                    className={`flex items-center gap-3 rounded-xl border p-2 ${
                      ej.catalogo_id
                        ? 'border-[var(--color-borde)]'
                        : 'border-amber-500/40 bg-amber-500/5'
                    }`}
                  >
                    <div className="w-20 shrink-0">
                      <AnimacionEjercicio
                        catalogoId={ej.catalogo_id}
                        nombre={ej.nombre}
                        ratio="aspect-square"
                      />
                    </div>
                    <Campo
                      value={ej.nombre}
                      onChange={(e) => {
                        const dias = [...leido.estructura.dias]
                        const ejercicios = [...dia.ejercicios]
                        ejercicios[ei] = { ...ej, nombre: e.target.value }
                        dias[di] = { ...dia, ejercicios }
                        cambiarEstructura({ ...leido.estructura, dias })
                      }}
                      className="min-h-11 flex-1 text-sm"
                    />
                    <button
                      onClick={() => setEditando({ dia: di, ej: ei })}
                      aria-label={`Cambiar animación de ${ej.nombre}`}
                      className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-[var(--color-texto)]"
                    >
                      <Settings2 size={18} />
                    </button>
                    <button
                      onClick={() => {
                        const dias = [...leido.estructura.dias]
                        dias[di] = {
                          ...dia,
                          ejercicios: dia.ejercicios.filter((_, i) => i !== ei),
                        }
                        cambiarEstructura({ ...leido.estructura, dias })
                      }}
                      aria-label={`Quitar ${ej.nombre}`}
                      className="shrink-0 rounded-lg p-2 text-[var(--color-suave)] hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        ))}

        <div className="sticky bottom-0 flex gap-2 bg-[var(--color-tarjeta)] pt-3 pb-1">
          <Boton className="flex-1" onClick={() => void guardar(true)}>
            Guardar y activar
          </Boton>
          <Boton variante="secundario" onClick={() => void guardar(false)}>
            Solo guardar
          </Boton>
        </div>

        {editando && (
          <SelectorAnimacion
            abierto
            onCerrar={() => setEditando(null)}
            nombreEjercicio={
              leido.estructura.dias[editando.dia].ejercicios[editando.ej].nombre
            }
            catalogoActual={
              leido.estructura.dias[editando.dia].ejercicios[editando.ej]
                .catalogo_id
            }
            onElegir={(id) => {
              const dias = [...leido.estructura.dias]
              const dia = dias[editando.dia]
              const ejercicios = [...dia.ejercicios]
              ejercicios[editando.ej] = {
                ...ejercicios[editando.ej],
                catalogo_id: id,
              }
              dias[editando.dia] = { ...dia, ejercicios }
              const estructura = { ...leido.estructura, dias }
              setLeido({
                ...leido,
                estructura,
                sinAnimacion: estructura.dias
                  .filter((d) => d.tipo === 'gimnasio')
                  .flatMap((d) => d.ejercicios)
                  .filter((e) => !e.catalogo_id)
                  .map((e) => e.nombre),
              })
            }}
          />
        )}
      </div>
    )
  }

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={paso === 'analizando' ? () => {} : cerrar}
      titulo={
        paso === 'revisar' ? 'Revisa lo que ha entendido' : 'Subir un plan en PDF'
      }
      ancho="max-w-3xl"
    >
      {contenido()}
    </Dialogo>
  )
}
