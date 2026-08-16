import { useState } from 'react'
import { AlertTriangle, Dumbbell, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Boton, Campo, Tarjeta } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { olvidarSesion } from '@/hooks/useAuth'

/**
 * Entrada a la app cuando hay cuenta configurada. Es de un solo usuario, así
 * que no hay recuperación de contraseña ni florituras: entrar o registrarse.
 */
export default function Entrar({ seAtasco = false }: { seAtasco?: boolean }) {
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true)
    try {
      if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: clave,
        })
        if (error) throw error
        if (data.session) toast.success('Cuenta creada')
        else {
          toast.success(
            'Cuenta creada. Revisa el correo y confirma antes de entrar.',
            { duration: 8000 },
          )
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: clave,
        })
        if (error) throw error
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al entrar'

      // El navegador se queja de la cabecera, no de la contraseña: lo que está
      // roto es lo que hay guardado aquí. Se limpia solo y se vuelve a cargar.
      if (mensaje.includes('ISO-8859-1') || mensaje.includes('RequestInit')) {
        toast.error('Los datos guardados en este navegador estaban dañados', {
          description: 'Se han limpiado. Ahora sí puedes entrar.',
          duration: 8000,
        })
        await olvidarSesion()
        return
      }

      toast.error(
        mensaje.includes('Invalid login')
          ? 'Correo o contraseña incorrectos'
          : mensaje.includes('Email not confirmed')
            ? 'Confirma el correo antes de entrar'
            : mensaje,
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-[var(--color-acento)] p-3 text-white">
            <Dumbbell size={28} />
          </span>
          <h1 className="text-3xl leading-tight font-bold">
            Entrenamiento Asistido
          </h1>
          <p className="text-sm text-[var(--color-suave)]">
            Entra para tener tus planes y tu histórico en el móvil y en el
            ordenador.
          </p>
        </div>

        {seAtasco && (
          <Tarjeta className="mb-4 flex gap-3 border-amber-500/40 bg-amber-500/10">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="text-sm">
              <p className="font-bold">No se pudo recuperar tu sesión</p>
              <p className="mt-1 text-[var(--color-suave)]">
                Suele pasar si la app se cerró de golpe. Entra otra vez: no se
                pierde nada, tus datos están en la cuenta.
              </p>
              <Boton
                variante="fantasma"
                className="mt-1 min-h-10 px-0"
                onClick={() => void olvidarSesion()}
              >
                <RefreshCw size={16} />
                Empezar de cero
              </Boton>
            </div>
          </Tarjeta>
        )}

        <Tarjeta>
          <form onSubmit={enviar} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
              >
                Correo
              </label>
              <Campo
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </div>
            <div>
              <label
                htmlFor="clave"
                className="mb-1 block text-xs font-bold text-[var(--color-suave)] uppercase"
              >
                Contraseña
              </label>
              <Campo
                id="clave"
                type="password"
                autoComplete={
                  modo === 'registro' ? 'new-password' : 'current-password'
                }
                required
                minLength={8}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <Boton type="submit" className="w-full" disabled={enviando}>
              {enviando
                ? 'Un momento…'
                : modo === 'registro'
                  ? 'Crear cuenta'
                  : 'Entrar'}
            </Boton>
          </form>

          <button
            onClick={() => setModo(modo === 'entrar' ? 'registro' : 'entrar')}
            className="mt-4 w-full text-center text-sm text-[var(--color-suave)] underline"
          >
            {modo === 'entrar'
              ? '¿Primera vez? Crear cuenta'
              : '¿Ya tienes cuenta? Entrar'}
          </button>
        </Tarjeta>
      </div>
    </div>
  )
}
