import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ajustesLocales, aplicarTema } from './lib/ajustes'
import './index.css'

// Se aplica antes de pintar nada, para que no dé un fogonazo blanco al arrancar
aplicarTema(ajustesLocales().tema)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
