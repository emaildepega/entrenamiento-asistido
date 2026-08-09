import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Tema guardado por el usuario (oscuro por defecto: se entrena a las 6 de la mañana)
const tema = localStorage.getItem('ea:tema')
if (tema === '"claro"') document.documentElement.dataset.tema = 'claro'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
