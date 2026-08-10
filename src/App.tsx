import { Suspense, lazy, useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { BarraTemporizador } from '@/components/BarraTemporizador'
import { NavInferior } from '@/components/NavInferior'
import { NavLateral } from '@/components/NavLateral'
import { AvisoSinConexion } from '@/components/AvisoSinConexion'
import { Cargando } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { ProveedorTemporizador } from '@/hooks/useTemporizador'
import { sincronizar } from '@/lib/sync'
import { sincronizarAjustes } from '@/hooks/useAjustes'
import { desbloquearAudio } from '@/lib/alarma'
import { configuracionRota, errorConfiguracion } from '@/lib/supabase'

const Hoy = lazy(() => import('@/pages/Hoy'))
const Semana = lazy(() => import('@/pages/Semana'))
const Progreso = lazy(() => import('@/pages/Progreso'))
const Planes = lazy(() => import('@/pages/Planes'))
const Ajustes = lazy(() => import('@/pages/Ajustes'))
const Ejercicio = lazy(() => import('@/pages/Ejercicio'))
const Historial = lazy(() => import('@/pages/Historial'))
const PlanDetalle = lazy(() => import('@/pages/PlanDetalle'))
const Entrar = lazy(() => import('@/pages/Entrar'))

export default function App() {
  const { cargando, sesion, modoLocal, seAtasco } = useAuth()
  const yaSincronizado = useRef<string | null>(null)

  // Al entrar (y al volver la conexión) se pone al día con la nube
  useEffect(() => {
    const usuario = sesion?.user.id
    if (!usuario || yaSincronizado.current === usuario) return
    yaSincronizado.current = usuario

    void sincronizarAjustes()
    void sincronizar().then((r) => {
      if (r.errores > 0) {
        toast.warning(
          `${r.errores} cambios no se han podido sincronizar`,
          { description: r.detalle ?? undefined, duration: 10000 },
        )
      }
    })

    const alVolver = () => void sincronizar()
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [sesion])

  // El navegador del móvil solo deja sonar avisos si el audio se preparó a raíz
  // de un toque del usuario. Se hace con el primero, sea donde sea.
  useEffect(() => {
    const alTocar = () => desbloquearAudio()
    window.addEventListener('pointerdown', alTocar, { once: true })
    window.addEventListener('keydown', alTocar, { once: true })
    return () => {
      window.removeEventListener('pointerdown', alTocar)
      window.removeEventListener('keydown', alTocar)
    }
  }, [])

  // Configuración mal puesta: se dice qué pasa en vez de fallar por dentro
  if (configuracionRota) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <h1 className="text-xl font-bold">La conexión no está bien puesta</h1>
          <p className="mt-2 text-sm text-[var(--color-suave)]">
            {errorConfiguracion}
          </p>
          <p className="mt-3 text-sm text-[var(--color-suave)]">
            Se arregla volviendo a poner la variable{' '}
            <code className="rounded bg-black/20 px-1">
              VITE_SUPABASE_ANON_KEY
            </code>{' '}
            en Vercel con el valor completo, y desplegando de nuevo.
          </p>
        </div>
      </div>
    )
  }

  if (cargando) return <Cargando texto="Comprobando la sesión…" />

  if (!modoLocal && !sesion) {
    return (
      <>
        <Suspense fallback={<Cargando />}>
          <Entrar seAtasco={seAtasco} />
        </Suspense>
        <Toaster position="top-center" theme="dark" />
      </>
    )
  }

  return (
    <BrowserRouter>
      <ProveedorTemporizador>
        <AvisoSinConexion />
        <NavLateral />

        {/* Móvil: una columna con navegación abajo. Escritorio: barra lateral.
            El hueco de abajo crece con la barra del temporizador para que
            nunca tape el botón de terminar la sesión. */}
        <main className="min-h-dvh px-4 pt-6 pb-[calc(7rem+var(--alto-temporizador))] md:pb-[calc(3rem+var(--alto-temporizador))] md:pl-60">
          <div className="mx-auto max-w-2xl md:max-w-5xl md:px-6 md:pt-4 xl:max-w-6xl">
            <Suspense fallback={<Cargando />}>
              <Routes>
                <Route path="/" element={<Hoy />} />
                <Route path="/sesion/:fecha" element={<Hoy />} />
                <Route path="/semana" element={<Semana />} />
                <Route path="/progreso" element={<Progreso />} />
                <Route path="/historial" element={<Historial />} />
                <Route path="/planes" element={<Planes />} />
                <Route path="/plan/:id" element={<PlanDetalle />} />
                <Route path="/ajustes" element={<Ajustes />} />
                <Route path="/ejercicio/:slug" element={<Ejercicio />} />
              </Routes>
            </Suspense>
          </div>
        </main>

        <BarraTemporizador />

        <div className="md:hidden">
          <NavInferior />
        </div>

        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{ style: { fontWeight: 600 } }}
        />
      </ProveedorTemporizador>
    </BrowserRouter>
  )
}
