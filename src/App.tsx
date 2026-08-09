import { Suspense, lazy, useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { NavInferior } from '@/components/NavInferior'
import { NavLateral } from '@/components/NavLateral'
import { AvisoSinConexion } from '@/components/AvisoSinConexion'
import { Cargando } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { sincronizar } from '@/lib/sync'
import { sincronizarAjustes } from '@/hooks/useAjustes'

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
  const { cargando, sesion, modoLocal } = useAuth()
  const yaSincronizado = useRef<string | null>(null)

  // Al entrar (y al volver la conexión) se pone al día con la nube
  useEffect(() => {
    const usuario = sesion?.user.id
    if (!usuario || yaSincronizado.current === usuario) return
    yaSincronizado.current = usuario

    void sincronizarAjustes()
    void sincronizar().then((r) => {
      if (r.errores > 0) {
        toast.warning(`${r.errores} cambios no se han podido sincronizar`)
      }
    })

    const alVolver = () => void sincronizar()
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [sesion])

  if (cargando) return <Cargando texto="Comprobando la sesión…" />

  if (!modoLocal && !sesion) {
    return (
      <>
        <Suspense fallback={<Cargando />}>
          <Entrar />
        </Suspense>
        <Toaster position="top-center" theme="dark" />
      </>
    )
  }

  return (
    <BrowserRouter>
      <AvisoSinConexion />
      <NavLateral />

      {/* Móvil: una columna con navegación abajo. Escritorio: barra lateral. */}
      <main className="min-h-dvh px-4 pt-6 pb-28 md:pb-12 md:pl-60">
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

      <div className="md:hidden">
        <NavInferior />
      </div>

      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{ style: { fontWeight: 600 } }}
      />
    </BrowserRouter>
  )
}
