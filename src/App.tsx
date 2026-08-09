import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { NavInferior } from '@/components/NavInferior'
import { NavLateral } from '@/components/NavLateral'
import { AvisoSinConexion } from '@/components/AvisoSinConexion'
import { Cargando } from '@/components/ui'

const Hoy = lazy(() => import('@/pages/Hoy'))
const Semana = lazy(() => import('@/pages/Semana'))
const Progreso = lazy(() => import('@/pages/Progreso'))
const Planes = lazy(() => import('@/pages/Planes'))
const Ajustes = lazy(() => import('@/pages/Ajustes'))
const Ejercicio = lazy(() => import('@/pages/Ejercicio'))
const Historial = lazy(() => import('@/pages/Historial'))

export default function App() {
  return (
    <BrowserRouter>
      <AvisoSinConexion />
      <NavLateral />

      {/* Móvil: una columna con navegación abajo. Escritorio: barra lateral. */}
      <main className="min-h-dvh px-4 pt-6 pb-28 md:pl-60 md:pb-12">
        <div className="mx-auto max-w-2xl md:max-w-5xl md:px-6 md:pt-4 xl:max-w-6xl">
          <Suspense fallback={<Cargando />}>
            <Routes>
              <Route path="/" element={<Hoy />} />
              <Route path="/sesion/:fecha" element={<Hoy />} />
              <Route path="/semana" element={<Semana />} />
              <Route path="/progreso" element={<Progreso />} />
              <Route path="/historial" element={<Historial />} />
              <Route path="/planes" element={<Planes />} />
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
