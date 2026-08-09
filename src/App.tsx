import { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { NavInferior } from '@/components/NavInferior'
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
      <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-6 pb-28">
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
      </main>
      <NavInferior />
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{ style: { fontWeight: 600 } }}
      />
    </BrowserRouter>
  )
}
